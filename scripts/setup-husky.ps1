# PowerShell script to setup Husky pre-commit hook
# Run: powershell -ExecutionPolicy Bypass -File scripts/setup-husky.ps1

Write-Host "🔧 Setting up Husky..." -ForegroundColor Green

# Initialize Husky
npx husky install

# Create .husky directory if it doesn't exist
if (-not (Test-Path ".husky")) {
    New-Item -ItemType Directory -Path ".husky" -Force | Out-Null
}

# Create pre-commit hook content
$hookContent = @'
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
'@

# Write pre-commit hook
$hookPath = ".husky\pre-commit"
Set-Content -Path $hookPath -Value $hookContent -Encoding UTF8

Write-Host "✅ Husky setup complete!" -ForegroundColor Green
Write-Host "Pre-commit hooks will now run:" -ForegroundColor Cyan
Write-Host "  1. File type validation" -ForegroundColor White
Write-Host "  2. ESLint" -ForegroundColor White
Write-Host "  3. TypeScript type check" -ForegroundColor White
Write-Host ""
Write-Host "Next time you commit, checks will run automatically!" -ForegroundColor Yellow
