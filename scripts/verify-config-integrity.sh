#!/bin/bash

# Script to verify critical configuration files haven't been tampered with
# This can be run manually or in CI/CD to ensure configs are intact

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Verifying configuration integrity..."
echo ""

ERRORS=0

# Check package.json scripts
echo "Checking package.json scripts..."

if ! grep -q '"type-check":.*"tsc --noEmit"' package.json; then
  echo -e "${RED}✗ type-check script has been modified!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ type-check script is intact${NC}"
fi

if ! grep -q '"lint":.*"npm-run-all lint:js lint:css"' package.json; then
  echo -e "${RED}✗ lint script has been modified!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ lint script is intact${NC}"
fi

if ! grep -q '"build":.*"tsc && vite build"' package.json; then
  echo -e "${RED}✗ build script has been modified!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ build script is intact${NC}"
fi

if ! grep -q '"test:ci":.*"vitest run --coverage"' package.json; then
  echo -e "${RED}✗ test:ci script has been modified!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ test:ci script is intact${NC}"
fi

# Check if husky is installed
echo ""
echo "Checking Husky installation..."

if ! grep -q '"prepare":.*"husky"' package.json; then
  echo -e "${RED}✗ Husky prepare script is missing or modified!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ Husky prepare script is intact${NC}"
fi

if [ ! -d ".husky" ]; then
  echo -e "${RED}✗ .husky directory is missing!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ .husky directory exists${NC}"
fi

# Check critical hooks exist
echo ""
echo "Checking Git hooks..."

if [ ! -f ".husky/pre-commit" ]; then
  echo -e "${RED}✗ pre-commit hook is missing!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ pre-commit hook exists${NC}"
fi

if [ ! -f ".husky/commit-msg" ]; then
  echo -e "${RED}✗ commit-msg hook is missing!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ commit-msg hook exists${NC}"
fi

if [ ! -f ".husky/pre-push" ]; then
  echo -e "${RED}✗ pre-push hook is missing!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ pre-push hook exists${NC}"
fi

# Check ESLint config has boundaries plugin
echo ""
echo "Checking ESLint configuration..."

if [ ! -f "eslint.config.js" ]; then
  echo -e "${RED}✗ eslint.config.js is missing!${NC}"
  ERRORS=$((ERRORS + 1))
elif ! grep -q "eslint-plugin-boundaries" eslint.config.js; then
  echo -e "${RED}✗ ESLint boundaries plugin is not configured!${NC}"
  ERRORS=$((ERRORS + 1))
elif ! grep -q "boundaries/dependencies" eslint.config.js; then
  echo -e "${RED}✗ ESLint boundaries rules are not configured!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ ESLint boundaries plugin is configured${NC}"
fi

# Check TypeScript strict mode
echo ""
echo "Checking TypeScript configuration..."

if [ ! -f "tsconfig.json" ]; then
  echo -e "${RED}✗ tsconfig.json is missing!${NC}"
  ERRORS=$((ERRORS + 1))
elif ! grep -q '"strict": true' tsconfig.json; then
  echo -e "${YELLOW}⚠ TypeScript strict mode is not enabled${NC}"
else
  echo -e "${GREEN}✓ TypeScript strict mode is enabled${NC}"
fi

# Check CI workflow exists
echo ""
echo "Checking CI/CD configuration..."

if [ ! -f ".github/workflows/ci.yml" ]; then
  echo -e "${RED}✗ CI workflow is missing!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ CI workflow exists${NC}"
fi

# Check CODEOWNERS exists
if [ ! -f ".github/CODEOWNERS" ]; then
  echo -e "${RED}✗ CODEOWNERS file is missing!${NC}"
  ERRORS=$((ERRORS + 1))
else
  echo -e "${GREEN}✓ CODEOWNERS file exists${NC}"

  # Check if CODEOWNERS has been updated from placeholder
  if grep -q "@your-github-username" .github/CODEOWNERS; then
    echo -e "${YELLOW}⚠ CODEOWNERS still has placeholder usernames${NC}"
  fi
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✓ All configuration checks passed!${NC}"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Found $ERRORS configuration issue(s)!${NC}"
  echo ""
  echo "Configuration integrity has been compromised."
  echo "Please restore the original configurations or get approval from tech leads."
  echo ""
  exit 1
fi
