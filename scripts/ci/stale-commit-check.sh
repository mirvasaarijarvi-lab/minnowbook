#!/usr/bin/env bash
# Compares the commit a workflow tested (TESTED_SHA) with the current head
# of its branch (HEAD_REPO@HEAD_REF). When the branch has moved on, the
# results are stale: prints a warning, writes a clear "STALE RESULT" block
# to the job summary, and sets stale=true in $GITHUB_OUTPUT.
# Exits 1 only when FAIL_ON_STALE=true.
#
# Env: GH_TOKEN, TESTED_SHA, HEAD_REPO, HEAD_REF, WORKFLOW_NAME (optional),
#      RUN_URL (optional), FAIL_ON_STALE (optional, default false)
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/null}"
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
name="${WORKFLOW_NAME:-this workflow}"

if [ -z "${HEAD_REF:-}" ] || [ -z "${TESTED_SHA:-}" ]; then
  echo "No branch to compare against (tag, detached or unknown ref); skipping."
  echo "stale=unknown" >> "$out"
  exit 0
fi

tip=$(gh api "repos/${HEAD_REPO}/commits/${HEAD_REF}" --jq '.sha' 2>/dev/null || echo "")
if [ -z "$tip" ]; then
  echo "::warning title=Stale check skipped::Could not read the head of ${HEAD_REPO}@${HEAD_REF} (branch deleted or API unavailable)."
  echo "stale=unknown" >> "$out"
  exit 0
fi

echo "tip_sha=${tip}" >> "$out"
if [ "$tip" = "$TESTED_SHA" ]; then
  echo "Up to date: ${name} tested ${TESTED_SHA}, the head of ${HEAD_REF}."
  echo "stale=false" >> "$out"
  exit 0
fi

behind=$(gh api "repos/${HEAD_REPO}/compare/${TESTED_SHA}...${tip}" --jq '.ahead_by' 2>/dev/null || echo "?")
echo "stale=true" >> "$out"
echo "behind_by=${behind}" >> "$out"
echo "::warning title=STALE RESULT::${name} tested ${TESTED_SHA:0:7}, but ${HEAD_REF} is now at ${tip:0:7} (${behind} newer commit(s)). These results do not describe the latest code."
{
  echo "## ⚠️ STALE RESULT"
  echo ""
  echo "**${name}** tested an older commit than the head of \`${HEAD_REF}\`."
  echo "Pass or fail, these results do not describe the latest code."
  echo ""
  echo "| | Commit |"
  echo "|---|---|"
  echo "| Tested | \`${TESTED_SHA}\` |"
  echo "| Branch head | \`${tip}\` |"
  echo "| Newer commits | ${behind} |"
  [ -n "${RUN_URL:-}" ] && echo "" && echo "Run: ${RUN_URL}"
  echo ""
  echo "Look at the run for \`${tip:0:7}\` instead, or re-run this workflow on the latest commit."
} >> "$summary"

if [ "${FAIL_ON_STALE:-false}" = "true" ]; then
  exit 1
fi
