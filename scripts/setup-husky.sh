#!/bin/bash

# Initialize Husky
npx husky install

# Create pre-commit hook
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Validate file types (TypeScript only)
echo "📋 Validating file types..."
npm run lint:files
if [ $? -ne 0 ]; then
  echo "❌ File type validation failed!"
  exit 1
fi

# Run ESLint
echo "✓ File types valid. Running ESLint..."
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ ESLint check failed!"
  exit 1
fi

# Type check
echo "✓ ESLint passed. Running TypeScript type check..."
npm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ Type check failed!"
  exit 1
fi

echo "✅ All pre-commit checks passed!"
EOF

chmod +x .husky/pre-commit

echo "✅ Husky setup complete!"
echo "Pre-commit hooks will now run: file validation → ESLint → type check"
