# Code Coverage Setup with Codecov

## Overview

This project uses Codecov for code coverage reporting and tracking. Coverage reports are automatically generated and uploaded on every push and pull request.

## Current Setup

### Coverage Targets

- **Project Coverage**: Minimum 70% (with 2% threshold)
- **PR Patch Coverage**: Minimum 80% (with 5% threshold)
- **CI fails if**: Coverage drops below targets

### What's Configured

1. **Vitest** - Generates coverage reports using v8
2. **GitHub Actions** - Runs tests and uploads coverage
3. **Codecov** - Displays coverage reports and trends
4. **codecov.yml** - Configuration file

## Setup Steps

### 1. Sign Up for Codecov (One-time)

1. Go to [codecov.io](https://codecov.io/)
2. Sign in with your GitHub account
3. Click "Add new repository"
4. Select `Rareminds-eym/rm-lms`
5. Copy the upload token (you'll need this)

### 2. Add Codecov Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `CODECOV_TOKEN`
5. Value: Paste the token from Codecov
6. Click **Add secret**

### 3. Update CI Workflow (Already Done)

The workflow is already configured to:

- Run tests with coverage on Node 20.x
- Upload coverage to Codecov
- Upload coverage artifacts to GitHub
- Fail CI if coverage upload fails

### 4. Verify Setup

Push a commit and check:

```bash
git add .
git commit -m "chore: setup codecov"
git push
```

Then:

1. Go to GitHub Actions tab
2. Check the CI workflow run
3. Look for "Upload coverage to Codecov" step
4. Should see: "Coverage uploaded successfully"

## Using Codecov

### View Coverage Reports

1. Go to [codecov.io/gh/Rareminds-eym/rm-lms](https://codecov.io/gh/Rareminds-eym/rm-lms)
2. View overall coverage percentage
3. Browse file-by-file coverage
4. See coverage trends over time

### PR Comments

Codecov automatically comments on PRs with:

- Coverage change (increase/decrease)
- Files with coverage changes
- Overall project coverage
- Patch coverage (new code coverage)

### Coverage Badge

The README includes a coverage badge that shows current coverage:

```markdown
[![codecov](https://codecov.io/gh/Rareminds-eym/rm-lms/branch/main/graph/badge.svg)](https://codecov.io/gh/Rareminds-eym/rm-lms)
```

## Configuration (codecov.yml)

### Coverage Targets

```yaml
coverage:
  status:
    project:
      default:
        target: 70% # Minimum project coverage
        threshold: 2% # Allow 2% drop before failing

    patch:
      default:
        target: 80% # New code must have 80% coverage
        threshold: 5% # Allow 5% variance
```

### Ignored Paths

The following are excluded from coverage:

- Test files (`*.test.ts`, `*.spec.ts`)
- Config files (`*.config.js`, `*.config.ts`)
- Build artifacts (`build/`, `dist/`, `coverage/`)
- Type definitions (`*.d.ts`)
- Scripts and tooling

## Local Coverage Reports

### Generate Coverage Locally

```bash
# Run tests with coverage
npm run test:coverage

# Open HTML report
open coverage/index.html
# or on Linux:
xdg-open coverage/index.html
```

### Coverage Commands

```bash
# Run tests with coverage
npm run test:coverage

# Run tests in CI mode (no watch)
npm run test:ci

# Run tests in watch mode (no coverage)
npm test
```

## Coverage Thresholds

### Current Thresholds

- **Overall Project**: 70% minimum
- **New Code (PR Patch)**: 80% minimum
- **Threshold**: 2% drop allowed for project, 5% for patches

### Why These Numbers?

- **70% project**: Realistic for existing code, allows gradual improvement
- **80% patch**: Higher bar for new code to improve overall coverage
- **Thresholds**: Prevents small fluctuations from failing CI

### Adjusting Thresholds

Edit `codecov.yml`:

```yaml
coverage:
  status:
    project:
      default:
        target: 75% # Increase to 75%
```

## Troubleshooting

### Coverage Upload Fails

**Error**: "Failed to upload coverage"

**Solutions**:

1. Check `CODECOV_TOKEN` is set in GitHub Secrets
2. Verify token is correct on codecov.io
3. Check coverage file exists: `ls -la coverage/lcov.info`
4. Re-run the workflow

### Coverage Not Showing on PR

**Solutions**:

1. Ensure PR is from a branch in the same repo (not a fork)
2. Check Codecov app is installed on the repository
3. Verify coverage was uploaded successfully in CI logs

### Coverage Percentage Seems Wrong

**Solutions**:

1. Check `codecov.yml` ignore patterns
2. Verify test files are being excluded
3. Run locally: `npm run test:coverage` and check `coverage/index.html`

### CI Fails Due to Coverage Drop

**Solutions**:

1. Add tests to increase coverage
2. Check which files lost coverage in Codecov PR comment
3. If intentional, adjust threshold in `codecov.yml`

## Best Practices

### Writing Tests for Coverage

```typescript
// Good: Test all branches
describe('calculateDiscount', () => {
  it('should apply 10% discount for students', () => {
    expect(calculateDiscount('student', 100)).toBe(90);
  });

  it('should apply 20% discount for teachers', () => {
    expect(calculateDiscount('teacher', 100)).toBe(80);
  });

  it('should apply no discount for others', () => {
    expect(calculateDiscount('guest', 100)).toBe(100);
  });
});
```

### Focus on Meaningful Coverage

- Don't chase 100% coverage
- Focus on business logic and critical paths
- Test edge cases and error handling
- Skip trivial code (getters, setters)

### Coverage Goals

- **Critical code**: 90%+ (auth, payments, data processing)
- **Business logic**: 80%+ (features, calculations)
- **UI components**: 70%+ (user interactions)
- **Utilities**: 80%+ (reusable functions)

## GitHub Actions Artifacts

Coverage reports are also uploaded as GitHub Actions artifacts:

1. Go to GitHub Actions → Select a workflow run
2. Scroll to "Artifacts" section
3. Download "coverage-report"
4. Extract and open `index.html`

Artifacts are kept for 30 days.

## Integration with Protected Configs

The codecov.yml file is protected by CODEOWNERS:

- Changes require approval from @rareminds-git or @gokulrajr-r
- Prevents lowering coverage thresholds without review
- Ensures coverage standards are maintained

## Monitoring Coverage Trends

### Weekly Review

1. Check coverage trend on Codecov dashboard
2. Identify files with low coverage
3. Plan to add tests for critical uncovered code

### Monthly Goals

- Aim to increase coverage by 1-2% per month
- Focus on one module/feature at a time
- Celebrate coverage milestones with the team

## Resources

- [Codecov Documentation](https://docs.codecov.com/)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles/)

## Summary

✅ Codecov configured with 70% project and 80% patch targets
✅ Automatic coverage upload on every push/PR
✅ PR comments with coverage changes
✅ Coverage badge in README
✅ Local coverage reports available
✅ Protected by CODEOWNERS

**Next**: Add `CODECOV_TOKEN` to GitHub Secrets to enable uploads.

---

**Questions?** Contact @rareminds-git or @gokulrajr-r
