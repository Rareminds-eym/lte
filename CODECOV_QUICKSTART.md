# Codecov Setup - Quick Start

## ✅ What's Already Configured

- ✅ `codecov.yml` - Coverage targets (70% project, 80% patch)
- ✅ CI workflow - Uploads coverage on every push/PR
- ✅ Coverage badge - Added to README
- ✅ Protected by CODEOWNERS - Requires approval to modify
- ✅ GitHub Actions artifacts - Coverage reports saved for 30 days

## 🚀 Quick Setup (5 minutes)

### Step 1: Sign Up for Codecov

1. Go to https://codecov.io/
2. Click "Sign in with GitHub"
3. Authorize Codecov
4. Click "Add new repository"
5. Select `Rareminds-eym/rm-lms`
6. Copy the **Upload Token**

### Step 2: Add Token to GitHub

1. Go to https://github.com/Rareminds-eym/rm-lms/settings/secrets/actions
2. Click "New repository secret"
3. Name: `CODECOV_TOKEN`
4. Value: Paste the token from Step 1
5. Click "Add secret"

### Step 3: Verify It Works

```bash
# Make any change
echo "// test" >> README.md

# Commit and push
git add .
git commit -m "chore: test codecov"
git push
```

Then:

1. Go to GitHub Actions tab
2. Wait for CI to complete
3. Check "Upload coverage to Codecov" step
4. Should see: ✅ "Coverage uploaded successfully"
5. Visit https://codecov.io/gh/Rareminds-eym/rm-lms

## 📊 Coverage Targets

- **Project**: 70% minimum (allows 2% drop)
- **New Code (PRs)**: 80% minimum (allows 5% variance)
- **CI fails if**: Coverage drops below targets

## 🔧 Local Coverage

```bash
# Generate coverage report
npm run test:coverage

# Open in browser
open coverage/index.html
```

## 📚 Full Documentation

See `docs/CODECOV_SETUP.md` for:

- Detailed configuration
- Troubleshooting
- Best practices
- Coverage goals by code type

## ✅ Checklist

- [ ] Sign up for Codecov
- [ ] Add `CODECOV_TOKEN` to GitHub Secrets
- [ ] Push a commit to test
- [ ] Verify coverage uploads successfully
- [ ] Check coverage badge appears in README

---

**Questions?** See docs/CODECOV_SETUP.md or contact @rareminds-git @gokulrajr-r
