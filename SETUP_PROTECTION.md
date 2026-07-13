# Configuration Protection Setup Checklist

Complete these steps to fully protect your configuration files from unauthorized changes.

## Prerequisites

- [ ] Repository is hosted on GitHub
- [ ] You have admin access to the repository
- [ ] At least 2 team members will be designated as code owners

## Step 1: Update CODEOWNERS File

1. Open `.github/CODEOWNERS`
2. Replace `@your-github-username` with actual GitHub usernames of tech leads
3. Example:
   ```
   eslint.config.js @tech-lead-1 @tech-lead-2
   tsconfig.json @tech-lead-1 @tech-lead-2
   ```
4. Commit and push the changes

## Step 2: Enable Branch Protection (Main Branch)

### Via GitHub UI:

1. Go to your repository on GitHub
2. Click **Settings** → **Branches**
3. Click **Add branch protection rule**
4. Branch name pattern: `main`
5. Enable these settings:
   - ✅ **Require a pull request before merging**
     - Required approving reviews: `1` (or `2` for stricter control)
     - ✅ Dismiss stale pull request approvals when new commits are pushed
     - ✅ **Require review from Code Owners** ⚠️ CRITICAL
   - ✅ **Require status checks to pass before merging**
     - ✅ Require branches to be up to date before merging
     - Search and add: `Code Quality (20.x)` and `Code Quality (22.x)`
   - ✅ **Require conversation resolution before merging**
   - ✅ **Do not allow bypassing the above settings**
   - ✅ **Restrict who can push to matching branches**
     - Select: Restrict pushes that create matching branches
6. Click **Create** or **Save changes**

### Via GitHub CLI:

```bash
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Code Quality (20.x)","Code Quality (22.x)"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"dismiss_stale_reviews":true,"require_code_owner_reviews":true,"required_approving_review_count":1}' \
  --field restrictions=null
```

## Step 3: Enable Branch Protection (Develop Branch)

Repeat Step 2 for the `develop` branch.

## Step 4: Verify Protection is Working

### Test 1: Try to push directly to main

```bash
git checkout main
echo "test" >> README.md
git add README.md
git commit -m "test: direct push"
git push origin main
```

**Expected**: Push should be rejected

### Test 2: Create PR with config change

```bash
git checkout -b test/config-change
echo "// test" >> eslint.config.js
git add eslint.config.js
git commit -m "test: config change"
git push origin test/config-change
```

Then create a PR on GitHub.

**Expected**: Code owners should be automatically requested for review

### Test 3: Try to merge without approval

**Expected**: Merge button should be disabled until code owner approves

## Step 5: Set Up Notifications

1. Go to **Settings** → **Notifications** → **Custom routing**
2. Add routing for:
   - `.github/CODEOWNERS` changes
   - `.github/workflows/` changes
   - Branch protection changes
3. Route to: Tech leads' email or Slack

## Step 6: Document and Communicate

- [ ] Share `docs/CONFIGURATION_PROTECTION.md` with the team
- [ ] Add to team onboarding documentation
- [ ] Announce in team meeting or Slack
- [ ] Pin the protection guide in your team channel

## Step 7: Regular Audits

Schedule these recurring tasks:

### Weekly

- [ ] Review open PRs touching config files
- [ ] Check for any `--no-verify` commits in recent history

### Monthly

- [ ] Verify branch protection settings are still enabled
- [ ] Review GitHub audit log for suspicious activity
- [ ] Update CODEOWNERS if team members change

### Quarterly

- [ ] Review and update protection rules if needed
- [ ] Audit ESLint boundaries rules
- [ ] Check CI/CD workflow is still comprehensive

## Verification Checklist

After setup, verify:

- [ ] `.github/CODEOWNERS` has real GitHub usernames (not placeholders)
- [ ] Branch protection is enabled for `main` branch
- [ ] Branch protection is enabled for `develop` branch
- [ ] "Require review from Code Owners" is checked
- [ ] "Require status checks to pass" is checked with CI jobs listed
- [ ] "Do not allow bypassing" is enabled
- [ ] Direct pushes to `main` are blocked
- [ ] PRs touching config files auto-request code owner review
- [ ] CI/CD runs on every push and PR
- [ ] Team has been notified about the protection rules

## Optional: Advanced Protection

### GitHub Rulesets (Recommended)

For more granular control:

1. Go to **Settings** → **Rules** → **Rulesets**
2. Click **New ruleset** → **New branch ruleset**
3. Name: "Protect Configuration Files"
4. Target: All branches
5. Add bypass actors: None (or only specific admins)
6. Rules:
   - ✅ Restrict file paths
   - Add patterns:
     ```
     eslint.config.js
     tsconfig*.json
     vite.config.ts
     package.json
     .prettierrc
     .stylelintrc.json
     commitlint.config.js
     .lintstagedrc.json
     .husky/**
     .github/workflows/**
     ```
   - ✅ Require pull request
   - ✅ Require code owner review
7. Save ruleset

### Slack/Discord Integration

Set up GitHub app integration to notify team channel when:

- Config files are modified
- Branch protection is changed
- Force push attempts occur

### Pre-receive Hooks (GitHub Enterprise)

If using GitHub Enterprise, set up server-side pre-receive hooks for additional validation.

## Troubleshooting

### "Code owners not being requested for review"

- Verify CODEOWNERS file syntax is correct
- Ensure "Require review from Code Owners" is enabled in branch protection
- Check that usernames in CODEOWNERS match GitHub usernames exactly

### "CI checks not blocking merge"

- Verify status check names match exactly (case-sensitive)
- Ensure "Require status checks to pass" is enabled
- Check that CI workflow is running successfully

### "Team members can still bypass"

- Ensure "Do not allow bypassing" is enabled
- Check that users don't have admin privileges (admins can bypass by default unless restricted)
- Verify branch protection applies to the correct branches

## Support

If you encounter issues:

1. Check `.github/BRANCH_PROTECTION.md` for detailed configuration
2. Review `docs/CONFIGURATION_PROTECTION.md` for how protection works
3. Consult GitHub's documentation on branch protection
4. Contact your GitHub admin or DevOps team

## Summary

Once completed, your configuration files are protected by:

1. ✅ CODEOWNERS requiring tech lead approval
2. ✅ Branch protection enforcing reviews and CI
3. ✅ Git hooks providing local warnings
4. ✅ CI/CD validating all changes server-side
5. ✅ ESLint boundaries enforcing FSD architecture

**No one can bypass all layers. Your code quality and architecture are protected.**

---

**Setup Date**: **\*\***\_**\*\***  
**Verified By**: **\*\***\_**\*\***  
**Next Audit**: **\*\***\_**\*\***
