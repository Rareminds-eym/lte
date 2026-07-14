#!/bin/bash

# Verification script for project setup
# Run this to verify all tools are properly configured

set -e

echo "🔍 Verifying Project Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v)
echo "   Node.js: $NODE_VERSION"
if [[ "$NODE_VERSION" < "v16" ]]; then
    echo -e "${RED}   ❌ Node.js version must be >= 16.0.0${NC}"
    exit 1
else
    echo -e "${GREEN}   ✅ Node.js version OK${NC}"
fi
echo ""

# Check npm version
echo "📦 Checking npm version..."
NPM_VERSION=$(npm -v)
echo "   npm: $NPM_VERSION"
echo -e "${GREEN}   ✅ npm installed${NC}"
echo ""

# Check if node_modules exists
echo "📦 Checking dependencies..."
if [ -d "node_modules" ]; then
    echo -e "${GREEN}   ✅ Dependencies installed${NC}"
else
    echo -e "${YELLOW}   ⚠️  Dependencies not installed. Run: npm install${NC}"
fi
echo ""

# Check configuration files
echo "🔧 Checking configuration files..."
files=(
    "eslint.config.js"
    ".prettierrc"
    ".stylelintrc.json"
    "commitlint.config.js"
    "tsconfig.json"
    "vite.config.ts"
    ".editorconfig"
    ".nvmrc"
    ".npmrc"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}   ✅ $file${NC}"
    else
        echo -e "${RED}   ❌ $file missing${NC}"
    fi
done
echo ""

# Check Husky hooks
echo "🐶 Checking Husky hooks..."
hooks=(
    ".husky/pre-commit"
    ".husky/commit-msg"
    ".husky/pre-push"
)

for hook in "${hooks[@]}"; do
    if [ -f "$hook" ]; then
        echo -e "${GREEN}   ✅ $hook${NC}"
    else
        echo -e "${RED}   ❌ $hook missing${NC}"
    fi
done
echo ""

# Check documentation
echo "📚 Checking documentation..."
docs=(
    "README.md"
    "TEAM_ONBOARDING.md"
    "CONTRIBUTING.md"
    "CODE_OF_CONDUCT.md"
    "SECURITY.md"
    "CHANGELOG.md"
    "LICENSE"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}   ✅ $doc${NC}"
    else
        echo -e "${RED}   ❌ $doc missing${NC}"
    fi
done
echo ""

# Check GitHub workflows
echo "🔄 Checking CI/CD workflows..."
workflows=(
    ".github/workflows/ci.yml"
    ".github/workflows/codeql.yml"
)

for workflow in "${workflows[@]}"; do
    if [ -f "$workflow" ]; then
        echo -e "${GREEN}   ✅ $workflow${NC}"
    else
        echo -e "${RED}   ❌ $workflow missing${NC}"
    fi
done
echo ""

# Check Docker files
echo "🐳 Checking Docker configuration..."
docker_files=(
    "Dockerfile"
    "docker-compose.yml"
    ".dockerignore"
    "nginx.conf"
)

for file in "${docker_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}   ✅ $file${NC}"
    else
        echo -e "${RED}   ❌ $file missing${NC}"
    fi
done
echo ""

# Check VS Code configuration
echo "💻 Checking VS Code configuration..."
vscode_files=(
    ".vscode/settings.json"
    ".vscode/extensions.json"
    ".vscode/launch.json"
)

for file in "${vscode_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}   ✅ $file${NC}"
    else
        echo -e "${RED}   ❌ $file missing${NC}"
    fi
done
echo ""

# Check package.json scripts
echo "📜 Checking npm scripts..."
scripts=(
    "start"
    "build"
    "test"
    "lint"
    "lint:fix"
    "format"
    "type-check"
    "validate"
)

for script in "${scripts[@]}"; do
    if npm run | grep -q "  $script$"; then
        echo -e "${GREEN}   ✅ npm run $script${NC}"
    else
        echo -e "${RED}   ❌ npm run $script missing${NC}"
    fi
done
echo ""

# Run quick validation
echo "🧪 Running quick validation..."
echo ""

echo "   Running type check..."
if npm run type-check > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Type check passed${NC}"
else
    echo -e "${YELLOW}   ⚠️  Type check has issues${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo -e "${GREEN}✨ Setup verification complete!${NC}"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Run: npm install (if not done)"
echo "  2. Run: npm run validate"
echo "  3. Test git hooks: git commit -m 'test: verify hooks'"
echo "  4. Read: TEAM_ONBOARDING.md"
echo ""
