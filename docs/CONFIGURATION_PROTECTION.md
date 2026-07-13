# Configuration Protection Guide

## Overview

This project has multiple layers of protection to ensure code quality standards and architectural rules (FSD) cannot be bypassed or modified without proper review.

## Protection Layers

### 1. CODEOWNERS File (`.github/CODEOWNERS`)

**What it does**: Automatically requests reviews from designated owners when specific files are modified.

**Protected files**:

- `eslint.config.js` - ESLint rules including FSD boundaries
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Build configuration
- `package.json` - Dependencies and scripts
- All linting/formatting configs
- Git hooks (`.husky/`)
- CI/CD workflows (`.github/workflows/`)

**How it works**:

- When you create a PR touching these files, tech leads are automatically added as reviewers
- PR cannot be merged without their approval (when branch protection is enabled)

**Setup required**: Update `.github/CODEOWNERS` with actual GitHub usernames.

### 2. Branch Protection Rules

**What it does**: Enforces rules on protected branches (main, develop).

**Key protections**:

- ✅ Require PR reviews before merging
- ✅ Require code owner approval for config files
- ✅ Require all CI checks to pass
- ✅ Prevent force pushes
- ✅ Prevent deletion of protected branches
- ✅ No direct commits to protected branches

**Setup required**: See `.github/BRANCH_PROTECTION.md` for configuration steps.

### 3. Git Hooks (Husky)

**What it does**: Runs checks locally before commits and pushes.

**Hooks configured**:

- `pre-commit`: Lints and formats staged files
- `commit-msg`: Validates commit message format
- `pre-push`: Warns about config changes, runs type-check, lint, and build

**Can be bypassed locally**: Yes, with `--no-verify` flag
**Final protection**: CI/CD catches any bypasses

### 4. CI/CD Pipeline (GitHub Actions)

**What it does**: Runs comprehensive checks on every push and PR.

**Checks performed**:

- Type checking
- ESLint (including FSD boundaries)
- Prettier formatting
- Stylelint
- Tests with coverage
- Production build

**Cannot be bypassed**: Runs on GitHub servers, not locally
**Blocks merging**: When branch protection requires status checks

### 5. ESLint Boundaries Plugin

**What it does**: Enforces Feature-Sliced Design (FSD) architecture.

**Rules enforced**:

```
app → can import from: pages, widgets, features, entities, shared
pages → can import from: widgets, features, entities, shared
widgets → can import from: features, entities, shared
features → can import from: entities, shared
entities → can import from: shared
shared → cannot import from any layer
```

**Violations**: Cause ESLint errors that fail CI/CD

## How to Modify Configuration Files

### Step 1: Create a Branch

```bash
git checkout -b config/update-eslint-rules
```

### Step 2: Make Your Changes

Edit the configuration file with proper justification.

### Step 3: Test Locally

```bash
npm run validate  # Runs all checks
```

### Step 4: Commit with Conventional Commit Message

```bash
git add eslint.config.js
git commit -m "chore(config): update eslint rules for new pattern"
```

### Step 5: Push and Create PR

```bash
git push origin config/update-eslint-rules
```

The pre-push hook will warn you about config changes.

### Step 6: Request Review

- Create a PR on GitHub
- Code owners will be automatically added as reviewers
- Explain the reason for the change in the PR description
- Wait for approval from tech leads

### Step 7: Merge

Once approved and CI passes, merge the PR.

## Common Scenarios

### "I need to add a new ESLint rule"

1. Discuss with the team first
2. Create a PR with the change
3. Get code owner approval
4. Ensure CI passes

### "I need to add a new dependency"

1. Ensure it's necessary and vetted
2. Update `package.json`
3. Create a PR (code owner review required)
4. Document why the dependency is needed

### "I need to disable an ESLint rule temporarily"

**Don't modify the config file.** Instead, use inline comments:

```typescript
// eslint-disable-next-line boundaries/dependencies
import { Something } from '../wrong-layer';
```

Then create an issue to discuss the architectural concern.

### "The pre-push hook is too slow"

You can bypass locally with `--no-verify`, but:

- CI will still run all checks
- You won't catch issues early
- Not recommended for regular use

```bash
git push --no-verify  # Use sparingly
```

## What Happens If Someone Bypasses?

### Local Bypass (--no-verify)

- ✅ CI/CD catches it
- ✅ PR cannot be merged until fixed
- ✅ Code review catches it

### Tries to Modify Config Without Review

- ✅ CODEOWNERS requests tech lead review
- ✅ Branch protection prevents merge without approval
- ✅ CI/CD validates the changes

### Tries to Disable Branch Protection

- ✅ Requires admin access
- ✅ Audit log records the change
- ✅ Team is notified (if notifications are set up)

### Tries to Force Push to Main

- ✅ Branch protection prevents it
- ✅ Audit log records the attempt

## Monitoring and Auditing

### Regular Checks (Tech Leads)

1. **Weekly**: Review open PRs touching config files
2. **Monthly**: Audit branch protection settings
3. **Quarterly**: Review CODEOWNERS file for accuracy

### GitHub Audit Log

Access: Settings → Security → Audit log

Monitor for:

- Branch protection changes
- Force pushes
- Bypass attempts
- CODEOWNERS modifications

## Team Onboarding

When a new developer joins:

1. Share this document
2. Explain the FSD architecture
3. Show them how to check ESLint boundaries
4. Walk through the PR process for config changes
5. Emphasize: "Config changes need tech lead approval"

## FAQ

**Q: Why are config files protected?**
A: They control code quality, architecture, and CI/CD. Unauthorized changes can break builds, bypass quality checks, or violate architectural principles.

**Q: Can I disable ESLint rules I don't like?**
A: No. Discuss with the team first. Rules are there for consistency and quality.

**Q: What if I need to make an urgent config change?**
A: Create a PR, explain the urgency, and request expedited review from tech leads.

**Q: Can I bypass the FSD architecture rules?**
A: Only with explicit approval and inline ESLint disable comments. Document why.

**Q: Who are the code owners?**
A: Check `.github/CODEOWNERS` file for the current list.

**Q: What if a code owner is unavailable?**
A: Ensure multiple code owners are configured for redundancy.

## Summary

**Multiple layers protect your configuration:**

1. CODEOWNERS → Requires tech lead review
2. Branch Protection → Enforces reviews and CI
3. Git Hooks → Early local warnings
4. CI/CD → Final validation gate
5. ESLint Boundaries → Enforces FSD architecture

**No single point of failure. All layers work together.**

## Next Steps

1. ✅ Update `.github/CODEOWNERS` with actual usernames
2. ✅ Configure branch protection rules (see `.github/BRANCH_PROTECTION.md`)
3. ✅ Share this document with the team
4. ✅ Set up GitHub notifications for config file changes
5. ✅ Schedule regular audits

---

**Questions?** Contact the tech leads or create an issue.
