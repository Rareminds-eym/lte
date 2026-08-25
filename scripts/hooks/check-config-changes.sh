#!/bin/bash

# Script to check if critical configuration files have been modified
# This runs as part of pre-push hook to warn developers

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Critical config files that require code owner review
CRITICAL_FILES=(
  "eslint.config.js"
  "tsconfig.json"
  "tsconfig.node.json"
  "vite.config.ts"
  "package.json"
  "package-lock.json"
  ".prettierrc"
  ".stylelintrc.json"
  "commitlint.config.js"
  ".lintstagedrc.json"
  ".gitignore"
  ".prettierignore"
  ".stylelintignore"
  ".secretlintignore"
  ".secretlintrc.json"
  ".npmrc"
  ".nvmrc"
  "Dockerfile"
  "docker-compose.yml"
  "nginx.conf"
  ".editorconfig"
  ".github/workflows/"
  ".github/CODEOWNERS"
  ".husky/"
  "scripts/"
  ".vscode/"
)

# Get the current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Get the remote tracking branch
REMOTE_BRANCH=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)

if [ -z "$REMOTE_BRANCH" ]; then
  # No remote tracking branch, compare with main
  REMOTE_BRANCH="origin/main"
fi

# Check if any critical files have been modified
MODIFIED_CRITICAL_FILES=()

for file in "${CRITICAL_FILES[@]}"; do
  if git diff --name-only "$REMOTE_BRANCH"...HEAD | grep -q "^$file"; then
    MODIFIED_CRITICAL_FILES+=("$file")
  fi
done

# If critical files were modified, show warning
if [ ${#MODIFIED_CRITICAL_FILES[@]} -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}⚠️  WARNING: Critical configuration files have been modified!${NC}"
  echo ""
  echo "The following files require code owner review:"
  for file in "${MODIFIED_CRITICAL_FILES[@]}"; do
    echo -e "  ${RED}•${NC} $file"
  done
  echo ""
  echo "These files control:"
  echo "  • Code quality standards"
  echo "  • Architecture enforcement (FSD)"
  echo "  • CI/CD pipelines"
  echo "  • Git hooks"
  echo ""
  echo "Please ensure:"
  echo "  1. You have discussed these changes with tech leads"
  echo "  2. Your PR will be reviewed by code owners"
  echo "  3. Branch protection rules are enabled on the remote"
  echo ""
  echo -e "${YELLOW}Continuing with push...${NC}"
  echo ""
fi

exit 0
