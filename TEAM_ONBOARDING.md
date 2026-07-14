# Team Onboarding Guide

Welcome to the LMS project! This guide will help you get set up and productive quickly.

## 🚀 Quick Setup (5 minutes)

### Prerequisites

- Node.js >= 18.0.0 ([Download](https://nodejs.org/))
- npm >= 9.0.0 (comes with Node.js)
- Git ([Download](https://git-scm.com/))
- VS Code (recommended) ([Download](https://code.visualstudio.com/))

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/Rareminds-eym/rm-lms.git
   cd rm-lms
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your local configuration
   ```

4. **Verify setup**

   ```bash
   npm run verify
   ```

5. **Start development server**
   ```bash
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000)

## 🛠️ Development Workflow

### Daily Commands

```bash
# Start development
npm start

# Run tests
npm test

# Fix code issues
npm run lint:fix
npm run format

# Before committing
npm run validate
```

### Git Workflow

1. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make changes and commit**

   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   Commit format: `type(scope): description`
   - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

3. **Push and create PR**
   ```bash
   git push origin feat/your-feature-name
   ```

### Automated Checks

The project has automated checks that run:

**On Commit (pre-commit hook):**

- Lints and formats only staged files
- Auto-fixes issues when possible

**On Commit Message (commit-msg hook):**

- Validates commit message format
- Must follow: `type(scope): subject`

**On Push (pre-push hook):**

- TypeScript type checking
- Full linting (JS/TS + CSS)
- Production build

## 📁 Project Structure

```
lms/
├── src/                    # Source code
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript types
│   ├── App.tsx             # Main app
│   └── index.tsx           # Entry point
├── public/                 # Static assets
├── docs/                   # Documentation
├── .github/                # GitHub config & CI/CD
├── .husky/                 # Git hooks
└── .vscode/                # VS Code settings
```

## 🎨 Code Style

### Automatic Formatting

- Code is automatically formatted on save (if using VS Code)
- Prettier handles formatting
- ESLint handles code quality

### Manual Formatting

```bash
npm run format          # Format all files
npm run lint:fix        # Fix linting issues
```

### Best Practices

- Use TypeScript for all new files
- Write tests for new features
- Keep components small and focused
- Use meaningful variable names
- Add comments for complex logic

## 🧪 Testing

```bash
# Run tests in watch mode
npm test

# Run tests once with coverage
npm run test:coverage

# Run tests in CI mode
npm run test:ci
```

### Writing Tests

- Place tests next to the component: `Component.test.tsx`
- Use React Testing Library
- Follow AAA pattern: Arrange, Act, Assert
- Aim for 70%+ coverage

## 🐛 Debugging

### VS Code Debugging

1. Press F5 or use Debug panel
2. Choose "Chrome: Launch"
3. Set breakpoints in your code

### Browser DevTools

- React DevTools extension recommended
- Use `console.log()` sparingly (will show warnings)

## 📝 Documentation

- **Team Onboarding**: [TEAM_ONBOARDING.md](TEAM_ONBOARDING.md) - Start here!
- **Contributing**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **Configuration Protection**: [docs/CONFIGURATION_PROTECTION.md](docs/CONFIGURATION_PROTECTION.md) - **IMPORTANT**
- **Setup Protection**: [SETUP_PROTECTION.md](SETUP_PROTECTION.md) - For tech leads
- **Architecture**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Deployment**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## ⚠️ Configuration Files - READ THIS

**IMPORTANT**: This project has protected configuration files that require tech lead approval to modify.

### Protected Files Include:

- `eslint.config.js`, `tsconfig.json`, `vite.config.ts`
- `package.json`, `package-lock.json`
- All linting/formatting configs
- Git hooks (`.husky/`)
- CI/CD workflows (`.github/workflows/`)
- Docker configs
- Ignore files (`.gitignore`, `.prettierignore`, etc.)

### Why Are They Protected?

- Maintain code quality standards
- Enforce FSD architecture boundaries
- Prevent bypassing CI/CD checks
- Ensure consistent development environment

### If You Need to Modify Config Files:

1. **Discuss with tech leads first**
2. Create a PR (code owners will be auto-requested)
3. Explain the reason in PR description
4. Wait for approval before merging

**See [docs/CONFIGURATION_PROTECTION.md](docs/CONFIGURATION_PROTECTION.md) for complete details.**

## 🔧 VS Code Setup

### Install Recommended Extensions

When you open the project, VS Code will prompt you to install recommended extensions:

- ESLint
- Prettier
- Stylelint
- EditorConfig
- Code Spell Checker

Or install manually:

```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension stylelint.vscode-stylelint
code --install-extension editorconfig.editorconfig
```

### Settings

The project includes VS Code settings that:

- Format on save
- Auto-fix ESLint issues on save
- Use project TypeScript version

## 🚨 Common Issues

### Issue: Git hooks not working

**Solution:**

```bash
npx husky install
```

### Issue: Build fails

**Solution:**

```bash
npm run clean
npm install
npm run build
```

### Issue: Tests failing

**Solution:**

```bash
npm test -- --clearCache
npm test
```

### Issue: Port 3000 already in use

**Solution:**

```bash
# Kill the process using port 3000
# Linux/Mac:
lsof -ti:3000 | xargs kill -9
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Issue: Module not found

**Solution:**

```bash
rm -rf node_modules package-lock.json
npm install
```

## 📊 Code Quality Standards

All code must pass:

- ✅ TypeScript compilation (no errors)
- ✅ ESLint (no errors, warnings OK)
- ✅ Prettier formatting
- ✅ 70% test coverage minimum
- ✅ All tests passing

## 🔐 Security

- Never commit secrets or API keys
- Use `.env.local` for local secrets
- All environment variables must start with `VITE_` (e.g., `VITE_API_URL`)
- Secretlint automatically checks for exposed secrets on commit
- Review security alerts in GitHub

## 🤝 Getting Help

1. **Check documentation** in `docs/` folder
2. **Search existing issues** on GitHub
3. **Ask in team chat** (Slack/Teams/Discord)
4. **Create an issue** using templates

## 📚 Learning Resources

### React & TypeScript

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)

### Testing

- [React Testing Library](https://testing-library.com/react)
- [Vitest Documentation](https://vitest.dev/)

### Tools

- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Conventional Commits](https://www.conventionalcommits.org/)

## ✅ Onboarding Checklist

- [ ] Clone repository
- [ ] Install Node.js and npm
- [ ] Run `npm install`
- [ ] Copy `.env.example` to `.env.local`
- [ ] Run `npm run verify`
- [ ] Install VS Code extensions
- [ ] Run `npm start` successfully
- [ ] Make a test commit
- [ ] **Read [docs/CONFIGURATION_PROTECTION.md](docs/CONFIGURATION_PROTECTION.md)** - IMPORTANT
- [ ] Understand which files are protected
- [ ] Read CONTRIBUTING.md
- [ ] Join team communication channels
- [ ] Review project architecture (FSD)
- [ ] Set up GitHub notifications

## 🎯 First Tasks

Good first tasks to get familiar with the codebase:

1. Fix a typo in documentation
2. Add a test for an existing component
3. Update a component's styling
4. Add a new utility function with tests

## 💡 Tips for Success

- **Commit often** - Small, focused commits are better
- **Write tests** - They save time in the long run
- **Ask questions** - No question is too small
- **Review code** - Learn from others' PRs
- **Keep learning** - Technology evolves quickly
- **Have fun** - Enjoy building great software!

## 🎉 Welcome to the Team!

You're all set! If you have any questions, don't hesitate to ask.

Happy coding! 🚀

---

Last updated: 2026-03-21
