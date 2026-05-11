# MimmoBook developer Make targets.
#
# Keep this file thin: each target should delegate to a script in
# `scripts/` or to an npm/bun command, so the same logic runs both
# locally and in CI without drifting.

.DEFAULT_GOAL := help

.PHONY: help scan-workflows

help: ## List available targets
	@awk 'BEGIN{FS=":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

scan-workflows: ## Scan dependabot/auto-merge workflows for forbidden triggers and unsafe checkout
	@bash scripts/scan-workflow-security.sh

