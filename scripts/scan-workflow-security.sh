#!/usr/bin/env bash
# Reusable wrapper around .github/scripts/scan-automerge-workflows.py
# so contributors can run the same gate locally that CI runs in
# .github/workflows/workflow-security-regression.yml.
#
# Scans .github/workflows/*dependabot*|*auto-merge* files for:
#   - Forbidden triggers (pull_request_target, workflow_run,
#     repository_dispatch, anything outside the allowlist).
#   - Insecure actions/checkout settings (missing
#     with.persist-credentials: false).
#   - Wildcard write permissions at workflow or job level.
#
# Usage:
#   scripts/scan-workflow-security.sh                       # scans .github/workflows
#   scripts/scan-workflow-security.sh path/to/workflows-dir
#
# Exit code mirrors the underlying scanner (0 on pass, 1+ on
# violations). PyYAML is auto-installed into a throwaway venv so a
# fresh checkout can run this without polluting the system Python.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SCANNER="${REPO_ROOT}/.github/scripts/scan-automerge-workflows.py"
TARGET_DIR="${1:-${REPO_ROOT}/.github/workflows}"

if [ ! -f "${SCANNER}" ]; then
  echo "error: scanner not found at ${SCANNER}" >&2
  exit 2
fi
if [ ! -d "${TARGET_DIR}" ]; then
  echo "error: workflows dir not found at ${TARGET_DIR}" >&2
  exit 2
fi

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  echo "error: ${PYTHON_BIN} is not on PATH" >&2
  exit 2
fi

# Prefer an existing PyYAML so we do not pay the venv cost every run.
if "${PYTHON_BIN}" -c "import yaml" >/dev/null 2>&1; then
  exec "${PYTHON_BIN}" "${SCANNER}" --dir "${TARGET_DIR}"
fi

VENV_DIR="${REPO_ROOT}/.cache/workflow-security-venv"
if [ ! -d "${VENV_DIR}" ]; then
  echo "Bootstrapping PyYAML into ${VENV_DIR} (one off)..." >&2
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
  "${VENV_DIR}/bin/pip" install --quiet --no-deps "pyyaml==6.0.2"
fi
exec "${VENV_DIR}/bin/python" "${SCANNER}" --dir "${TARGET_DIR}"
