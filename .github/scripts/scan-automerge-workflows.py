#!/usr/bin/env python3
"""
Scan GitHub Actions workflows whose filenames contain "dependabot" or
"auto-merge" for security regressions. Used by
.github/workflows/workflow-security-regression.yml as the sole
implementation of the gate, and by the same workflow's self-test job
to verify the gate fires correctly against synthetic fixtures.

Exit code:
  0  -> no violations
  1+ -> at least one violation (capped at 125 for POSIX)

Usage:
  scan-automerge-workflows.py --dir <path-to-workflows-dir>

Checks performed:
  1. No `pull_request_target` trigger (regex over comment-stripped YAML).
  2. No `workflow_run` or `repository_dispatch` triggers.
  3. Trigger allowlist: must include `pull_request`, may also include
     `workflow_dispatch` or `schedule`. Anything else is rejected.
  4. No wildcard write permissions (`permissions: write-all`) at the
     workflow or job level. No broad scope set to `write` at the
     workflow level (per-job grants are still allowed).
  5. Every `actions/checkout@*` step must set
     `with.persist-credentials: false`.
"""
from __future__ import annotations

import argparse
import pathlib
import re
import sys
from typing import Iterable

import yaml

ALLOWED_TRIGGERS = {"pull_request", "workflow_dispatch", "schedule"}
FORBIDDEN_TRIGGERS = {
    "pull_request_target",
    "workflow_run",
    "repository_dispatch",
}
BROAD_SCOPE_WRITES_AT_WORKFLOW = {
    "contents", "pull-requests", "issues", "actions",
    "deployments", "packages", "id-token", "security-events",
    "statuses", "checks", "pages", "discussions",
    "repository-projects",
}

COMMENT_RE = re.compile(r"^[[:space:]]*#.*$", re.MULTILINE)
PRT_RE = re.compile(
    r"(^|[^A-Za-z0-9_-])pull_request_target([^A-Za-z0-9_-]|$)"
)
OTHER_TRIGGERS_RE = re.compile(
    r"(^|[^A-Za-z0-9_-])(workflow_run|repository_dispatch)([^A-Za-z0-9_-]|$)"
)


def is_wildcard_write(perms: object) -> bool:
    """`permissions: write-all` grants every scope at write."""
    return isinstance(perms, str) and perms.strip() == "write-all"


def strip_full_line_comments(text: str) -> str:
    out_lines = []
    for line in text.splitlines():
        if re.match(r"^\s*#", line):
            continue
        out_lines.append(line)
    return "\n".join(out_lines)


def discover_files(directory: pathlib.Path) -> list[pathlib.Path]:
    if not directory.is_dir():
        return []
    matches: list[pathlib.Path] = []
    for p in sorted(directory.iterdir()):
        if not p.is_file():
            continue
        if p.suffix.lower() not in {".yml", ".yaml"}:
            continue
        name = p.name.lower()
        if "dependabot" in name or "auto-merge" in name:
            matches.append(p)
    return matches


def emit_error(file: pathlib.Path, message: str) -> None:
    # GitHub Actions error annotation format. Also readable in plain
    # logs for the self-test runner.
    print(f"::error file={file}::{message}")


def scan_file(path: pathlib.Path) -> int:
    raw = path.read_text()
    violations = 0

    # ---- Textual checks (regex on comment-stripped source) ----
    stripped = strip_full_line_comments(raw)
    if PRT_RE.search(stripped):
        emit_error(
            path,
            "Forbidden trigger 'pull_request_target' detected. Use "
            "'pull_request' instead, Dependabot PRs originate from "
            "in-repo branches and the default GITHUB_TOKEN is "
            "sufficient.",
        )
        violations += 1
    other_hits = {m.group(2) for m in OTHER_TRIGGERS_RE.finditer(stripped)}
    if other_hits:
        emit_error(
            path,
            f"Forbidden trigger(s) detected: {sorted(other_hits)}. "
            "These run from the default branch with full secrets and "
            "bypass the safety of 'pull_request' for an auto-merge "
            "workflow.",
        )
        violations += 1

    # ---- Structural checks (YAML walk) ----
    try:
        doc = yaml.safe_load(raw) or {}
    except Exception as e:
        emit_error(path, f"Failed to parse YAML: {e}")
        return violations + 1

    # YAML quirk: top-level key `on` is parsed as boolean True.
    triggers = doc.get("on", doc.get(True, {}))
    if isinstance(triggers, str):
        trigger_names = {triggers}
    elif isinstance(triggers, list):
        trigger_names = {str(t) for t in triggers}
    elif isinstance(triggers, dict):
        trigger_names = {str(k) for k in triggers.keys()}
    else:
        trigger_names = set()

    if not trigger_names:
        emit_error(
            path,
            "Auto-merge workflow has no detectable trigger. Use "
            "'on: pull_request:' with types [opened, reopened, "
            "synchronize, ready_for_review].",
        )
        violations += 1
    else:
        if "pull_request" not in trigger_names:
            emit_error(
                path,
                "Auto-merge workflow must include the 'pull_request' "
                f"trigger. Found: {sorted(trigger_names)}.",
            )
            violations += 1
        bad = trigger_names - ALLOWED_TRIGGERS
        if bad:
            emit_error(
                path,
                f"Auto-merge workflow uses disallowed trigger(s): "
                f"{sorted(bad)}. Allowed: {sorted(ALLOWED_TRIGGERS)}.",
            )
            violations += 1

    top_perms = doc.get("permissions")
    if is_wildcard_write(top_perms):
        emit_error(
            path,
            "Workflow-level 'permissions: write-all' grants every "
            "scope at write. Replace with 'permissions: {}' and "
            "re-grant only the scopes each job needs.",
        )
        violations += 1
    elif isinstance(top_perms, dict):
        for scope, level in top_perms.items():
            if (
                str(scope) in BROAD_SCOPE_WRITES_AT_WORKFLOW
                and str(level).strip() == "write"
            ):
                emit_error(
                    path,
                    f"Workflow-level permission '{scope}: write' is "
                    "too broad (applies to every job). Move this "
                    "grant into the specific job that needs it.",
                )
                violations += 1

    for job_name, job in (doc.get("jobs") or {}).items():
        if not isinstance(job, dict):
            continue
        job_perms = job.get("permissions")
        if is_wildcard_write(job_perms):
            emit_error(
                path,
                f"Job '{job_name}' uses 'permissions: write-all', "
                "which is a wildcard write grant. List specific "
                "scopes the job needs (e.g. 'contents: write').",
            )
            violations += 1

        for idx, step in enumerate(job.get("steps") or []):
            if not isinstance(step, dict):
                continue
            uses = str(step.get("uses", ""))
            if not uses.startswith("actions/checkout@"):
                continue
            with_block = step.get("with") or {}
            pc = with_block.get("persist-credentials")
            if pc is not False:
                step_label = step.get("name") or f"step #{idx}"
                emit_error(
                    path,
                    f"Job '{job_name}' step '{step_label}' uses "
                    f"'{uses}' without 'with.persist-credentials: "
                    "false'. Auto-merge workflows must do read-only "
                    "checkouts.",
                )
                violations += 1

    return violations


def main(argv: Iterable[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--dir",
        required=True,
        type=pathlib.Path,
        help="Directory containing workflow .yml files to scan.",
    )
    args = ap.parse_args(list(argv))

    files = discover_files(args.dir)
    if not files:
        print(
            f"No dependabot/auto-merge workflows found in {args.dir}, "
            "nothing to scan."
        )
        return 0

    print("Scanning the following workflows:")
    for f in files:
        print(f"  - {f}")

    total = 0
    for f in files:
        total += scan_file(f)

    if total > 0:
        print(
            f"\nFailing build: {total} regression(s) detected in "
            "dependabot/auto-merge workflows."
        )
        return min(total, 125)

    print(
        "OK: no auto-merge workflow uses pull_request_target, "
        "workflow_run, repository_dispatch, a disallowed trigger, "
        "a wildcard write permission, or an unsafe checkout."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
