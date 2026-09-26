#!/usr/bin/env bash
# Runs on every push. The commit the branch pointed at before the push
# (BEFORE) is now outdated, so every watched workflow run that already
# FINISHED on it gets a neutral "Stale result: <workflow>" check on that
# commit. Runs still in progress are left alone: they are cancelled by the
# newer push, or marked by the workflow_run job when they finish.
# Already-marked workflows are skipped, so re-runs never add duplicates.
#
# Env: GH_TOKEN, REPO, BEFORE, AFTER, BRANCH,
#      WORKFLOWS (one workflow name per line)
set -euo pipefail

summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

if [ -z "${BEFORE:-}" ] || [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
  echo "New branch or no previous commit; nothing became stale."
  exit 0
fi
if [ "$BEFORE" = "${AFTER:-}" ]; then
  echo "Branch did not move; nothing became stale."
  exit 0
fi

runs=$(gh api "repos/${REPO}/actions/runs?head_sha=${BEFORE}&per_page=100" \
  --jq '.workflow_runs[] | select(.status == "completed" and .conclusion != "cancelled") | [.name, .conclusion, .html_url] | @tsv' \
  2>/dev/null || echo "")
existing=$(gh api "repos/${REPO}/commits/${BEFORE}/check-runs?per_page=100" \
  --jq '.check_runs[].name' 2>/dev/null || echo "")

marked=0
declare -A seen=()
while IFS=$'\t' read -r wf conclusion url; do
  [ -z "$wf" ] && continue
  grep -Fxq -- "$wf" <<<"$WORKFLOWS" || continue
  [ -n "${seen[$wf]:-}" ] && continue
  seen[$wf]=1
  if grep -Fxq -- "Stale result: ${wf}" <<<"$existing"; then
    echo "Already marked: ${wf}"
    continue
  fi
  gh api "repos/${REPO}/check-runs" --method POST \
    -f name="Stale result: ${wf}" \
    -f head_sha="${BEFORE}" \
    -f status=completed \
    -f conclusion=neutral \
    -f "output[title]=STALE: ${wf} (${conclusion}) tested an older commit" \
    -f "output[summary]=This ${conclusion} result is for ${BEFORE:0:7}. ${BRANCH} has since moved to ${AFTER:0:7}, so it does not describe the latest code. Run: ${url}" \
    > /dev/null
  echo "Marked stale: ${wf} (${conclusion}) on ${BEFORE:0:7}"
  marked=$((marked + 1))
done <<<"$runs"

{
  echo "## Stale results after push"
  echo ""
  echo "\`${BRANCH}\` moved from \`${BEFORE:0:7}\` to \`${AFTER:0:7}\`."
  echo "Finished checks marked stale on the older commit: **${marked}**."
} >> "$summary"
