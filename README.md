# LTE - Learning Transform Engine



A modern Learning Transform Engine built with React, TypeScript, Vite, and a Feature-Sliced Design frontend structure. The repository also includes Cloudflare-style function modules for platform concerns such as authentication, users, courses, enrollments, uploads, and notifications.

## Features

- React 19 with TypeScript
- Vite development and production build setup
- React Router based application routing
- Feature-Sliced Design inspired frontend architecture
- API/function modules organized by Learning Transform Engine domain
- Vitest and React Testing Library test tooling
- ESLint, Prettier, Stylelint, Secretlint, Husky, and Commitlint for quality control
- GitHub Actions, CodeQL, Codecov, Docker, and Nginx configuration files

## Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0

The required runtime versions are defined in `package.json`.

## Getting Started

```bash
# Install dependencies
npm install

# Copy local environment variables
cp .env.example .env.local

# Start the standard development workflow
npm start
```

The Vite dev server is configured to run on `http://localhost:3000`.

For detailed onboarding notes, see [TEAM_ONBOARDING.md](TEAM_ONBOARDING.md).

## Available Scripts

### Development

- `npm start` - Builds in development mode, then starts worker and Pages development commands.
- `npm run dev` - Starts Vite in development mode on port `3000`.
- `npm run dev:local` - Starts Vite in development mode on port `8788`.
- `npm run dev:prod` - Starts Vite on port `8788`.
- `npm run preview` - Serves the production build locally with Vite preview.

### Build

- `npm run build` - Creates an optimized production build.
- `npm run build:dev` - Creates a development-mode build.
- `npm run pages:build` - Runs the production build for Pages usage.

The Vite build output directory is configured as `dist/`.

### Workers and Pages

- `npm run workers:dev` - Starts all configured worker development commands together.
- `npm run pages:dev` - Starts Wrangler Pages development with service bindings.

Note: `workers:dev` references worker-specific scripts for email, payments, SSO, and realtime services. If those scripts are not present in `package.json`, add them before using the combined worker command.

### Testing and Quality

- `npm test` - Runs Vitest.
- `npm run test:property` - Runs property tests under `src/__tests__/property/`.
- `npm run lint` - Runs ESLint and CSS linting over the project.
- `npm run lint:css` - **Validates Tailwind CSS usage** in stylesheets.
- `npm run lint:files` - **Validates that only .ts and .tsx files exist** in `src/` and `functions/` directories.
- `npm run lint:console` - **Detects console statements** in production code (use proper logging instead).
- `npm run lint:fsd` - **Runs Steiger linter** to check for FSD architectural boundary violations.
- `npm run lint:knip` - **Runs Knip linter** to check for dead code (unused files, exports, types, and dependencies).
- `npm run lint:biome` - **Runs Biome linter and formatter** for code quality and style.
- `npm run typecheck` - Runs TypeScript type checking with `tsconfig.app.json`.
- `npm run setup:husky` - Sets up Husky git hooks for pre-commit validation.

## Environment Variables

Copy `.env.example` to `.env.local` for local development.

```bash
cp .env.example .env.local
```

Current example variables include:

- `VITE_API_URL` - API server URL.
- `VITE_API_TIMEOUT` - API request timeout.
- `VITE_ENABLE_ANALYTICS` - Feature flag for analytics.
- `VITE_ENABLE_DEBUG` - Feature flag for debug behavior.
- `VITE_GOOGLE_ANALYTICS_ID` - Optional Google Analytics ID.
- `VITE_SENTRY_DSN` - Optional Sentry DSN.

Only variables prefixed with `VITE_` are exposed to frontend code by Vite.

## Project Structure

```text
learning-transform-engine/
|-- .github/
|   |-- workflows/
|   |   |-- ci.yml
|   |   `-- codeql.yml
|   |-- ISSUE_TEMPLATE/
|   |-- CODEOWNERS
|   |-- dependabot.yml
|   `-- PULL_REQUEST_TEMPLATE.md
|-- .husky/
|   |-- commit-msg
|   |-- pre-commit
|   `-- pre-push
|-- .vscode/
|   |-- extensions.json
|   `-- settings.json
|-- docs/
|   |-- ARCHITECTURE.md
|   |-- CODECOV_SETUP.md
|   |-- CONFIGURATION_PROTECTION.md
|   `-- DEPLOYMENT.md
|-- functions/
|   |-- api/
|   |   `-- v1/
|   |       |-- artifacts/
|   |       |-- auth/
|   |       |-- capabilities/
|   |       |-- courses/
|   |       |-- dashboard/
|   |       |-- learning-paths/
|   |       |-- readiness/
|   |       `-- settings/
|   |-- lib/
|   |   |-- artifact-evaluator/
|   |   |-- cookies.ts
|   |   |-- env.ts
|   |   |-- r2-client.ts
|   |   |-- skill-gateway.ts
|   |   |-- sso-client.ts
|   |   |-- supabase.ts
|   |   |-- sync-shadow.ts
|   |   `-- xp-engine.ts
|   |-- middleware/
|   |   |-- auth.ts
|   |   `-- rate-limiter.ts
|   |-- schemas/
|   |   |-- artifacts.ts
|   |   `-- index.ts
|   `-- shared/
|       `-- logger.ts
|-- public/
|   |-- favicon.ico
|   |-- manifest.json
|   `-- robots.txt
|-- scripts/
|   |-- check-config-changes.sh
|   |-- verify-config-integrity.sh
|   `-- verify-setup.sh
|-- src/
|   |-- app/
|   |   |-- App.tsx
|   |   |-- layouts/
|   |   |-- providers/
|   |   |   `-- AppProviders.tsx
|   |   |-- router/
|   |   |   |-- AppRouter.tsx
|   |   |   `-- guards/
|   |   |       `-- ProtectedRoute.tsx
|   |   |-- store/
|   |   |   `-- index.ts
|   |   `-- styles/
|   |       `-- index.css
|   |-- entities/
|   |   |-- active-learning-path/
|   |   |-- course/
|   |   |-- dashboard/
|   |   |-- session/
|   |   `-- settings/
|   |-- features/
|   |   `-- submit-artifact/
|   |-- pages/
|   |   |-- dashboard/
|   |   |-- course-detail/
|   |   |-- level-content/
|   |   |-- level-modules/
|   |   `-- settings/
|   |-- shared/
|   |   |-- api/
|   |   |   `-- index.ts
|   |   |-- assets/
|   |   |   |-- icons/
|   |   |   `-- images/
|   |   |-- config/
|   |   |   `-- index.ts
|   |   |-- hooks/
|   |   |   `-- index.ts
|   |   |-- lib/
|   |   |   `-- index.ts
|   |   |-- schemas/
|   |   |   `-- index.ts
|   |   |-- store/
|   |   |   `-- index.ts
|   |   |-- types/
|   |   |   `-- index.ts
|   |   `-- ui/
|   |       |-- ErrorFallback.tsx
|   |       `-- index.ts
|   |-- widgets/
|   |   `-- index.ts
|   `-- main.tsx
|-- .env.example
|-- Dockerfile
|-- docker-compose.yml
|-- eslint.config.js
|-- index.html
|-- nginx.conf
|-- package.json
|-- steiger.config.js
|-- tsconfig.json
|-- tsconfig.node.json
`-- vite.config.ts
```

## Structure Analysis

### Frontend application

- `src/main.tsx` is the Vite/React entry point.
- `src/app/App.tsx` wires the root router and global providers.
- `src/app/router/AppRouter.tsx` defines the current routes.
- `src/pages/` contains route-level pages such as `Dashboard` and `NotFound`.
- `src/shared/` contains reusable code that can be used across the app, including API exports, config, hooks, schemas, store helpers, types, and UI components.

### Feature-Sliced layers

The frontend follows a Feature-Sliced Design style layout:

- `app` - App initialization, providers, routing, global styles, and store setup.
- `pages` - Route screens and page-level composition.
- `widgets` - Larger UI blocks that can combine features and entities.
- `features` - User-facing actions and business feature modules.
- `entities` - Business entities and entity-specific logic.
- `shared` - Reusable infrastructure, UI, config, utilities, and types.

Recommended import direction:

- Higher layers may import from lower layers.
- Lower layers should not import from higher layers.
- `shared` should remain independent from app-specific layers.

### Function modules

The `functions/` directory separates backend/API behavior by Learning Transform Engine domain:

- `auth/` - Authentication handlers.
- `users/` - User lookup and user-related handlers.
- `courses/` - Course retrieval and course-related handlers.
- `enrollments/` - Enrollment workflows.
- `uploads/` - File upload workflows.
- `notifications/` - Notification sending workflows.
- `middleware/` - Shared request middleware such as auth and error handling.
- `schemas/` - Shared validation schemas.
- `shared/` - Shared backend utilities.

### Configuration and automation

- `.github/` contains CI, CodeQL, issue templates, pull request templates, and dependency automation.
- `.husky/` contains local Git hooks.
- `scripts/` contains setup and configuration integrity helper scripts.
- `docs/` contains architecture, deployment, Codecov, and configuration protection documentation.
- `Dockerfile`, `docker-compose.yml`, and `nginx.conf` support containerized production delivery.

## Architecture

The application currently uses:

- React for UI rendering.
- React Router for client-side routing.
- TypeScript for static typing.
- Vite for dev server, bundling, and Vitest integration.
- Zod and `@t3-oss/env-core` for schema and environment validation patterns.
- Cloudflare-oriented development scripts for Pages and worker service bindings.

The current default route is `/`, which renders the dashboard page. Unknown routes render the `NotFound` page.

## Tailwind CSS v4

This project uses **Tailwind CSS v4** for styling. All CSS must strictly use Tailwind utilities.

### Setup

Tailwind is already configured in the project:

- **Config**: `tailwind.config.ts` - Theme customization and content paths
- **PostCSS**: `postcss.config.js` - CSS processing pipeline
- **Global Styles**: `src/app/styles/index.css` - Tailwind directives and base layers
- **Linting**: `.stylelintrc.json` - CSS validation rules

### Usage

Use Tailwind utility classes directly in JSX:

```tsx
// ✅ Correct: Use Tailwind utilities
export function Button() {
  return (
    <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
      Click me
    </button>
  );
}

// ❌ Wrong: Don't write custom CSS
export function Button() {
  return <button className={styles.button}>Click me</button>;
}
```

### Available Colors

Custom colors defined in `tailwind.config.ts`:

- `primary` (#3b82f6) - Blue
- `secondary` (#8b5cf6) - Purple  
- `danger` (#ef4444) - Red
- `success` (#10b981) - Green
- `warning` (#f59e0b) - Amber
- `info` (#0ea5e9) - Cyan

Usage:
```tsx
<div className="bg-primary text-secondary">Content</div>
<div className="border border-danger">Error</div>
```

### Validation

CSS files are validated with Stylelint to enforce Tailwind usage:

```bash
# Check CSS files
npm run lint:css

# Runs automatically in full lint
npm run lint
```

The validation ensures:
- Only Tailwind `@apply` directives in custom CSS
- No hardcoded values in CSS files
- Proper use of `@layer` for component definitions
- No conflicting CSS rules

### Styling Patterns

**Component-level styling:**
```tsx
export function Card() {
  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold text-gray-900">Card Title</h2>
    </div>
  );
}
```

**Conditional classes:**
```tsx
export function Alert({ type = 'info' }) {
  const bgColor = {
    info: 'bg-blue-100',
    success: 'bg-green-100',
    error: 'bg-red-100',
  }[type];
  
  return <div className={bgColor}>Alert message</div>;
}
```

**Using `@apply` in CSS (for repeated patterns):**
```css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition;
  }
}
```

### Configuration Files

**`tailwind.config.ts`** - Extends theme with custom colors and settings
**`postcss.config.js`** - Processes CSS with Tailwind and Autoprefixer
**`src/app/styles/index.css`** - Global styles using Tailwind directives
**`.stylelintrc.json`** - Linting rules for Tailwind CSS files

### References

- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Tailwind CSS v4 Release](https://tailwindcss.com/blog/tailwindcss-v4)

---

## Code Quality Tools

This project includes configuration for:

- ESLint - JavaScript and TypeScript linting.
- Prettier - Formatting.
- Stylelint - CSS linting.
- Secretlint - Secret scanning.
- TypeScript - Static type checking.
- Husky - Git hook management.
- lint-staged - Checks staged files before commit.
- Commitlint - Conventional commit validation.
- CodeQL - GitHub security analysis.
- Codecov - Coverage reporting.

### TypeScript-Only Enforcement

This project enforces **strict TypeScript/TSX-only** code in `src/` and `functions/` directories. No JavaScript (`.js` or `.jsx`) files are allowed.

#### Setup (First Time)

```bash
# Install dependencies (if not done)
npm install

# Setup Husky git hooks (works on Windows, macOS, Linux)
npm run setup:husky
```

**Expected output:**
```
🔧 Setting up Husky pre-commit hooks...

📦 Installing Husky...
✅ Created .husky/pre-commit hook

✨ Husky setup complete!

🎯 Pre-commit hooks will now run:
  1. 📋 File type validation (TypeScript only)
  2. 🔍 Console usage detection
  3. 🎨 Biome linting and formatting
  4. 🔍 ESLint checks
  5. ✅ TypeScript type checking

🚀 Next time you run: git commit
   These checks will run automatically!
```

#### Validation Methods

1. **Manual Check** - Run anytime:
   ```bash
   npm run lint:files
   ```
   Output example:
   ```
   🔍 Validating file types (only .ts/.tsx allowed in src/ and functions/)...
   ✓ Checked src/
   ✓ Checked functions/
   ✅ All files are correct type (.ts/.tsx) in src/ and functions/
   ```

2. **Pre-commit Hook** - Runs automatically before every `git commit`:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   # ↓ Validation runs automatically
   # 🔍 Running pre-commit checks...
   # 📋 Validating file types...
   # ✓ File types valid. Checking for console usage...
   # 🎨 Running Biome linter and formatter...
   # ✓ Running ESLint...
   # ✓ ESLint passed. Running TypeScript type check...
   # ✅ All pre-commit checks passed!
   ```

3. **CI/CD Pipeline** - Runs on every push and PR via GitHub Actions (`.github/workflows/ci.yml`):
   - Validates file types
   - Runs ESLint
   - Type checks with TypeScript
   - Runs tests
   - Builds project

#### Allowed File Types

✅ **Allowed in `src/` and `functions/`:**
- `.ts` - TypeScript files
- `.tsx` - React + TypeScript files
- `.json` - Configuration and data files
- `.md` - Markdown documentation
- `.css` - Stylesheets (Tailwind, global styles)
- `.wasm` - WebAssembly modules

❌ **NOT Allowed:**
- `.js` - JavaScript files
- `.jsx` - React JavaScript files
- Any other file extensions

#### Enforcement Layers

The project uses **6 layers** of enforcement to prevent non-TypeScript files:

| Layer | Type | When It Runs | Action |
|-------|------|--------------|--------|
| 1 | TypeScript Config | Compilation | Rejects `.js`/`.jsx` files |
| 2 | ESLint Config | Linting | Ignores `.js`/`.jsx` files |
| 3 | Prettier Config | Formatting | Won't format non-TS files |
| 4 | Validation Script | Manual/Hook | Scans & reports violations |
| 5 | Git Hook (Husky) | Commit | Blocks commit if violations found |
| 6 | GitHub Actions CI | Push/PR | Fails build if violations found |

#### Troubleshooting

**"File type not allowed" error**

```bash
# See which files are violating
npm run lint:files

# Fix: Delete the .js file and recreate as .ts
rm src/utils/helper.js
# Create as TypeScript instead
echo "export const helper = () => {};" > src/utils/helper.ts
```

**"Husky hook not running"**

```bash
# Reinstall Husky
npm run setup:husky

# Make sure hook is executable
chmod +x .husky/pre-commit
```

**"I need to create a .js file temporarily"**

Please don't. If absolutely necessary:
1. Contact the team for an exception
2. Update `ALLOWED_EXTENSIONS` in `scripts/validate-file-types.js`
3. Add to `.prettierignore` and `tsconfig.json`
4. Document the exception in this README

### Console Usage Detection

The project scans for `console` statements in production code. Use proper logging instead.

**Check for console statements:**
```bash
npm run lint:console
```

**What it detects:**
- ❌ `console.log()`
- ❌ `console.debug()`
- ❌ `console.info()`
- ❌ `console.warn()`
- ❌ `console.error()`
- ❌ `console.trace()`

**What it ignores:**
- ✅ Test files (`.test.ts`, `.spec.tsx`)
- ✅ `.css`, `.json`, `.md` files
- ✅ `__tests__/` directory

**Better alternatives:**
```typescript
// ❌ Don't do this:
console.log('User logged in');

// ✅ Do this instead (if logger available):
logger.info('User logged in');

// ✅ Or use proper error handling:
try {
  // code
} catch (error) {
  // Log to monitoring service instead
}
```

**Example output:**
```
🔍 Scanning for console statements in src/ and functions/...

✓ Scanned src/
✓ Scanned functions/

⚠️  Found 2 console statement(s) in production code:

📄 src/features/auth/lib/useAuth.ts
   Line 42: console.log
   └─ console.log('User data:', userData);

📄 functions/auth/login.ts
   Line 18: console.debug
   └─ console.debug('Login attempt');

💡 Tip: Use proper logging (logger.debug(), logger.error()) instead of console
   Or remove console statements for production code
```

**More details** - See [VALIDATION_SETUP.md](VALIDATION_SETUP.md) for comprehensive setup guide.

## Git Hooks

- `pre-commit` - Runs staged-file checks.
- `commit-msg` - Validates commit message format.
- `pre-push` - Runs validation before pushing.

Use Conventional Commits:

```text
type(scope): subject

feat: add course enrollment flow
fix: resolve dashboard routing issue
docs: update project README
style: format styles
refactor: reorganize shared API client
test: add dashboard tests
chore: update dependencies
```

## Testing

```bash
# Run Vitest
npm test

# Run property tests
npm run test:property
```

Vitest is configured in `vite.config.ts` with:

- `jsdom` test environment.
- V8 coverage provider.
- 70 percent coverage thresholds for branches, functions, lines, and statements.

## Building for Production

```bash
npm run build
```

The optimized build is written to `dist/`.

## Deployment Notes

Deployment-related files are included in the repository:

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment guide.
- [Dockerfile](Dockerfile) - Container image definition.
- [docker-compose.yml](docker-compose.yml) - Local container orchestration.
- [nginx.conf](nginx.conf) - Nginx production server configuration.
- `.github/workflows/ci.yml` - Main CI workflow.
- `.github/workflows/codeql.yml` - Security scanning workflow.

## API / Backend Information

The LTE backend utilizes **Cloudflare Pages Functions** (located in the `functions/` directory) to handle API requests, business logic orchestration, and integrations.

### Key Architectures:
- **Routing:** Cloudflare Pages Functions automatically route incoming `/api/v1/*` requests to respective files under `functions/api/v1/`.
- **Supabase Integration:** The database client is initialized via `functions/lib/supabase.ts`. It acts as the sync target for user profiles and subscriptions.
- **SSO Synchronization:** Synchronizes users and organizations between SkillPassport and the LTE client application using the client implementation at `functions/lib/sso-client.ts`.
- **R2 Storage Client:** Handles file uploads and retrieves artifacts securely through Cloudflare R2 (`functions/lib/r2-client.ts`).
- **XP Engine:** Processes and awards XP points based on consistency, streak, and legacy rules (`functions/lib/xp-engine.ts`).

---

## Contributing Guidelines

We welcome contributions! To maintain a clean, stable, and highly structured codebase, all contributors must strictly adhere to the following rules:

### Branch Naming Conventions
- Features: `feat/short-description`
- Bug Fixes: `fix/short-description`
- Documentation: `docs/short-description`
- Code Quality/Refactoring: `refactor/short-description`
- Build/Config: `chore/short-description`

### Pull Request & Code Quality Flow
1. **Pass Staged/Pre-commit Hooks:** Running `git commit` automatically triggers Husky hooks that run file check rules, console check rules, ESLint, Biome checking/formatting, and typechecking.
2. **TypeScript Only:** Absolutely no `.js` or `.jsx` files are permitted in `src/` or `functions/`.
3. **No Unused Code:** Run `npm run lint:knip` to verify that no unused files, unused exports, or dead dependencies are introduced.
4. **FSD Compliance:** Run `npm run lint:fsd` to ensure there are no Feature-Sliced Design boundary cross-layer or peer-slice import violations. Keep components mobile-first and lazy-load route elements.
5. **Write Unit Tests:** Every new logic module or UI widget must have a corresponding Vitest unit test in the proper test path (e.g. `[Component].test.tsx` in `__tests__/`).
6. **Conventional Commits:** Commit messages must strictly follow the conventional commit format: `type(scope): message`.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Knowledge Graph

This project has a code-only knowledge graph at `graphify-out/` (1207 nodes, 1446 edges, 113 communities — 100% extracted from source, zero API cost). The graph maps cross-file relationships: imports, calls, inheritance, and references across `src/`, `functions/`, and config files.

### Prerequisites

- Python 3.10+
- `uv` (recommended) or `pipx`

### Install

```bash
uv tool install graphifyy
```

Verify: `graphify --version`

### Build

```bash
# From the lte directory
graphify .
```

This creates/updates `graphify-out/graph.json`. The `.graphifyignore` at the project root excludes build artifacts (`dist/`, `build/`, `.wrangler/`, `node_modules/`, etc.).

### Query

Once the graph is built, answer codebase questions without grepping files:

```bash
# Broad context — plain-language question
graphify query "how does SSO auth flow work?"

# Shortest path between two concepts
graphify path "SsoRpcService" "authStore.ts"

# Focused explanation of a node
graphify explain "AppRouter"
```

For queries specific to the lte subproject, pass `--graph lte/graphify-out/graph.json` from the monorepo root.

### Git

- `graphify-out/graph.json` is committed to the repo — pull and the graph is ready.
- `graphify-out/cost.json`, `graphify-out/cache/`, `graphify-out/*.html`, and `graphify-out/wiki/` are gitignored.
- After code changes, run `graphify update .` to refresh the graph (AST-only, no API cost).

### Optional — Post-commit auto-rebuild

```bash
graphify hook install
```

Rebuilds the graph automatically on every `git commit` (AST-only, free). Re-run after upgrading graphify.

## Useful References

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [Feature-Sliced Design](https://feature-sliced.design/)
