# LTE - Learning Transform Engine

[![CI](https://github.com/Rareminds-eym/rm-lms/workflows/CI/badge.svg)](https://github.com/Rareminds-eym/rm-lms/actions)
[![codecov](https://codecov.io/gh/Rareminds-eym/rm-lms/branch/main/graph/badge.svg)](https://codecov.io/gh/Rareminds-eym/rm-lms)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

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

- Node.js >= 20.0.0
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

The Vite build output directory is configured as `build/`.

### Workers and Pages

- `npm run workers:dev` - Starts all configured worker development commands together.
- `npm run pages:dev` - Starts Wrangler Pages development with service bindings.

Note: `workers:dev` references worker-specific scripts for email, payments, SSO, and realtime services. If those scripts are not present in `package.json`, add them before using the combined worker command.

### Testing and Quality

- `npm test` - Runs Vitest.
- `npm run test:property` - Runs property tests under `src/__tests__/property/`.
- `npm run lint` - Runs ESLint over the project.
- `npm run typecheck` - Runs TypeScript type checking with `tsconfig.app.json`.

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
|   |-- auth/
|   |   `-- login.ts
|   |-- courses/
|   |   `-- getCourses.ts
|   |-- enrollments/
|   |   `-- enrollUser.ts
|   |-- middleware/
|   |   |-- auth.ts
|   |   `-- errorHandler.ts
|   |-- notifications/
|   |   `-- sendNotification.ts
|   |-- schemas/
|   |   `-- index.ts
|   |-- shared/
|   |   `-- index.ts
|   |-- uploads/
|   |   `-- uploadFile.ts
|   `-- users/
|       `-- getUser.ts
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
|   |   `-- index.ts
|   |-- features/
|   |   `-- index.ts
|   |-- pages/
|   |   |-- Dashboard.tsx
|   |   `-- NotFound.tsx
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

The optimized build is written to `build/`.

## Deployment Notes

Deployment-related files are included in the repository:

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment guide.
- [Dockerfile](Dockerfile) - Container image definition.
- [docker-compose.yml](docker-compose.yml) - Local container orchestration.
- [nginx.conf](nginx.conf) - Nginx production server configuration.
- `.github/workflows/ci.yml` - Main CI workflow.
- `.github/workflows/codeql.yml` - Security scanning workflow.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for contribution guidelines.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Useful References

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/)
- [Feature-Sliced Design](https://feature-sliced.design/)
