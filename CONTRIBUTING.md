# Contributing Guide

Thank you for considering contributing to this project! This guide will help you get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Code Quality Tools](#code-quality-tools)
- [Git Workflow](#git-workflow)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)

## Development Setup

1. Fork the repository and clone your fork:

```bash
git clone https://github.com/[your-username]/lms.git
cd lms
```

2. Install dependencies:

```bash
npm install
```

3. Create a branch for your feature or fix:

```bash
git checkout -b feat/your-feature-name
```

4. Set up environment variables:

```bash
cp .env.example .env.local
```

5. Start the development server:

```bash
npm start
```

## Code Quality Tools

This project uses industry-standard tools to maintain code quality:

### ESLint

- Lints TypeScript and JavaScript code
- Run: `npm run lint:js`
- Auto-fix: `npm run lint:fix:js`

### Stylelint

- Lints CSS files
- Run: `npm run lint:css`
- Auto-fix: `npm run lint:fix:css`

### Prettier

- Formats code consistently
- Run: `npm run format`
- Check formatting: `npm run format:check`

### TypeScript

- Type checking without emitting files
- Run: `npm run type-check`

### Run All Checks

```bash
npm run validate
```

This runs type-check, lint, format-check, secret detection, tests, and build.

## Git Workflow

### Husky Git Hooks

This project uses Husky to enforce code quality through Git hooks:

#### pre-commit

- Runs `lint-staged` to lint and format only staged files
- Ensures code quality before committing
- Automatically fixes issues when possible

#### commit-msg

- Validates commit messages follow conventional commits format
- Prevents commits with invalid messages

#### pre-push

- Runs type checking, linting, and build
- Prevents pushing broken code to remote

### Bypassing Hooks (Not Recommended)

In rare cases where you need to bypass hooks:

```bash
git commit --no-verify -m "your message"
```

**Note:** This should only be used in exceptional circumstances.

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
type(scope): subject

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring without changing functionality
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependency changes
- `ci`: CI/CD configuration changes
- `chore`: Other changes that don't modify src or test files
- `revert`: Revert a previous commit

### Examples

```bash
feat(auth): add user login functionality
fix(navigation): resolve broken menu links
docs(readme): update installation instructions
style(app): format code with prettier
refactor(components): extract reusable button component
test(auth): add unit tests for login flow
chore(deps): update react to v19
```

### Scope (Optional)

The scope should be the name of the affected module or feature:

- `auth`
- `navigation`
- `components`
- `api`
- `utils`

## Pull Request Process

1. **Update your branch** with the latest changes from main:

```bash
git checkout main
git pull origin main
git checkout your-branch
git rebase main
```

2. **Run all checks** before submitting:

```bash
npm run validate
```

3. **Push your changes**:

```bash
git push origin your-branch
```

4. **Create a Pull Request** on GitHub with:
   - Clear title following conventional commits format
   - Detailed description of changes
   - Screenshots (if UI changes)
   - Link to related issues

5. **Address review feedback** promptly

6. **Ensure CI passes** - All GitHub Actions checks must pass

## Code Style Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new files
- Prefer functional components with hooks
- Use meaningful variable and function names
- Keep functions small and focused
- Add JSDoc comments for complex logic
- Avoid `any` type - use proper types or `unknown`

### React Best Practices

- Use functional components
- Extract reusable logic into custom hooks
- Keep components small and focused
- Use proper prop types
- Avoid inline styles - use CSS classes
- Use React.memo() for expensive components

### CSS

- Use meaningful class names
- Follow BEM naming convention when appropriate
- Keep selectors simple and specific
- Avoid deep nesting
- Use CSS variables for theming

### Testing

- Write tests for all new features
- Aim for high test coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies

### File Organization

- One component per file
- Co-locate tests with components
- Group related files in folders
- Use index files for clean imports

## Questions?

If you have questions, please:

1. Check existing issues and discussions
2. Read the documentation
3. Ask in a new issue with the `question` label

Thank you for contributing! 🎉
