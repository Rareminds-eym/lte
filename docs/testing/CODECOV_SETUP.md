# Code Coverage Setup with Codecov

## Overview

GitHub Actions generates and validates coverage on every push and pull request.
Codecov is an optional reporting integration that must be enabled after registering
this repository with Codecov.

## Current Setup

- Vitest enforces 80% lines/statements and 75% branches/functions coverage.
- Pull requests must cover at least 80% of changed executable lines.
- GitHub retains generated reports in the `coverage-reports` artifact for 14 days,
  including reports from runs that fail coverage validation.
- Coverage totals appear in the GitHub Actions job summary.
- Codecov uploads use GitHub OIDC and run only when the repository Actions variable
  `CODECOV_ENABLED` is exactly `true`. An enabled upload still fails CI on error.

Disabling the external reporting integration does not disable either coverage gate.

## Enable Codecov

1. Sign in to Codecov with access to the `Rareminds-eym` organization.
2. Register/activate `Rareminds-eym/lte` and grant the Codecov GitHub integration
   access to this repository. Confirm Codecov recognizes the exact owner/repository.
3. In GitHub repository **Settings → Secrets and variables → Actions → Variables**,
   add `CODECOV_ENABLED` with value `true`.
4. Run CI and verify **Upload coverage to Codecov** succeeds.

The workflow requests `id-token: write` for OIDC authentication; no
`CODECOV_TOKEN` repository secret is required by this configuration. A valid OIDC
identity does not activate an unregistered repository: Codecov can still reject it
with `Repository not found`. Complete repository registration before enabling
uploads. When uploads are disabled, CI emits an explicit notice and the reports
remain available in GitHub Actions.

## Using Codecov

### View Coverage Reports

1. Go to [codecov.io/gh/Rareminds-eym/lte](https://codecov.io/gh/Rareminds-eym/lte)
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
[![codecov](https://codecov.io/gh/Rareminds-eym/lte/branch/main/graph/badge.svg)](https://codecov.io/gh/Rareminds-eym/lte)
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

### Required CI Gates

Vitest requires 80% lines/statements and 75% branches/functions. The separate PR
patch validator requires 80% of changed executable lines. These checks run even
when Codecov is disabled. Their configuration lives in `vite.config.ts` and
`scripts/checks/validate-patch-coverage.js`.

### Optional Codecov Status Targets

`codecov.yml` configures a 70% project target with 2% tolerance and an 80% patch
target with 5% tolerance. These external reporting targets apply once Codecov is
activated; they do not replace the stricter required CI gates above.

## Troubleshooting

### Coverage Upload Fails

**Error**: "Failed to upload coverage"

**Solutions**:

1. Confirm `Rareminds-eym/lte` is registered in Codecov and accessible to its GitHub integration.
2. Confirm `CODECOV_ENABLED=true` is set only after registration is complete.
3. Keep the job's `id-token: write` permission for OIDC authentication.
4. Check coverage file exists: `ls -la coverage/lcov.info`, then re-run CI.

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
3. Download "coverage-reports"
4. Extract and open `lcov-report/index.html`

Artifacts are kept for 14 days.

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

CI enforces coverage thresholds, publishes job-summary totals, and retains coverage
artifacts independently of Codecov. To enable external dashboards and PR comments,
register `Rareminds-eym/lte` in Codecov, then set `CODECOV_ENABLED=true`.
