# Architecture Structure

## Project Root

- `.github/` - GitHub workflows, ownership, templates, and automation.
- `.husky/` - Git hook entry files.
- `.vscode/` - Workspace editor settings.
- `docs/` - Project documentation.
- `functions/` - Cloudflare Pages Functions backend.
- `public/` - Static public assets.
- `scripts/` - Project utility scripts.
- `src/` - Frontend application source.
- `supabase/` - Supabase-related schema, migrations, or setup files.

## File Structure

```text
lte/
|-- .github/
|   |-- workflows/
|   |-- ISSUE_TEMPLATE/
|   |-- CODEOWNERS
|   `-- dependabot.yml
|-- .husky/
|   |-- pre-commit
|   |-- commit-msg
|   `-- pre-push
|-- .vscode/
|-- docs/
|   |-- architecture/
|   |-- deployment/
|   |-- getting-started/
|   `-- testing/
|-- functions/
|   |-- auth/
|   |-- middleware/
|   |-- schemas/
|   `-- shared/
|-- public/
|   |-- assets/
|   |-- icons/
|   |-- images/
|   |-- fonts/
|   |-- manifest.json
|   |-- robots.txt
|   `-- favicon.ico
|-- scripts/
|-- src/
|   |-- app/
|   |   |-- layouts/
|   |   |-- providers/
|   |   |-- router/
|   |   |-- store/
|   |   `-- styles/
|   |-- pages/
|   |-- widgets/
|   |-- features/
|   |-- entities/
|   |-- shared/
|   |   |-- api/
|   |   |-- assets/
|   |   |-- config/
|   |   |-- hooks/
|   |   |-- lib/
|   |   |-- schemas/
|   |   |-- store/
|   |   |-- types/
|   |   `-- ui/
|   `-- main.tsx
|-- supabase/
|-- index.html
|-- package.json
|-- package-lock.json
|-- vite.config.ts
|-- tsconfig.json
|-- tsconfig.app.json
|-- tsconfig.node.json
|-- eslint.config.js
|-- biome.json
|-- postcss.config.js
|-- tailwind.config.ts
|-- Dockerfile
|-- docker-compose.yml
`-- nginx.conf
```

## Root Configuration

- `.codereview.yml` - Code review configuration.
- `.dockerignore` - Docker ignore list.
- `.editorconfig` - Editor formatting defaults.
- `.env.example` - Environment variable template.
- `.gitignore` - Git ignore list.
- `.lintstagedrc.json` - lint-staged configuration.
- `.npmrc` - npm registry and install configuration.
- `.nvmrc` - Node version hint.
- `.prettierignore` - Prettier ignore list.
- `.prettierrc` - Prettier configuration.
- `.secretlintignore` - Secretlint ignore list.
- `.secretlintrc.json` - Secretlint configuration.
- `.stylelintignore` - Stylelint ignore list.
- `.stylelintrc.json` - Stylelint configuration.
- `biome.json` - Biome configuration.
- `codecov.yml` - Codecov configuration.
- `commitlint.config.js` - Commitlint configuration.
- `docker-compose.yml` - Docker Compose configuration.
- `Dockerfile` - Docker image configuration.
- `eslint.config.js` - ESLint configuration.
- `index.html` - Vite HTML entry.
- `nginx.conf` - Nginx configuration.
- `package.json` - npm scripts and dependencies.
- `package-lock.json` - npm dependency lockfile.
- `postcss.config.js` - PostCSS configuration.
- `tailwind.config.ts` - Tailwind configuration.
- `tsconfig.app.json` - App TypeScript configuration.
- `tsconfig.json` - TypeScript root configuration.
- `tsconfig.node.json` - Node TypeScript configuration.
- `vite.config.ts` - Vite and Vitest configuration.

## Frontend Structure

### `src/app/`

Application initialization and global wiring.

- `layouts/` - App-level layouts.
- `providers/` - App-wide providers.
- `router/` - Route definitions and guards.
- `store/` - Global store setup.
- `styles/` - Global styles.

### `src/pages/`

Route-level page modules.

- Dashboard pages.
- Auth pages.
- Course pages.
- Error pages.
- Public pages.

### `src/widgets/`

Page-level composed UI sections.

- Header.
- Sidebar.
- Navigation.
- Course lists.
- Dashboards.
- Notification sections.

### `src/features/`

User-facing feature modules.

- Authentication.
- Course enrollment.
- Course search.
- Profile editing.
- Notifications.
- Payments.

### `src/entities/`

Business entity modules.

- User.
- Course.
- Enrollment.
- Organization.
- Notification.
- Payment.

### `src/shared/`

Reusable frontend building blocks.

- `api/` - Shared API clients.
- `assets/` - Shared assets.
- `config/` - Frontend configuration.
- `hooks/` - Shared hooks.
- `lib/` - Shared utilities.
- `schemas/` - Shared schemas.
- `store/` - Shared store utilities.
- `types/` - Shared TypeScript types.
- `ui/` - Shared UI components.

## Backend Structure

### `functions/`

Serverless backend functions.

- `auth/` - Authentication endpoints.
- `middleware/` - Backend middleware.
- `schemas/` - Backend schemas.
- `shared/` - Backend shared utilities.
- `lib/artifact-evaluator/` - Artifact evaluation AI engine: `artifact-extractor.ts` (XLSX/CSV/PDF/DOCX/TXT → text, 50k-char cap, 15-page cap, 20-sheet cap; dynamic `import()` of parsers incl. SheetJS; empty pages/sheets never count as content — scanned PDFs and empty/bogus files route to `human_review`; strict utf-8 with windows-1252 fallback for latin1 text), `artifact-evaluator.ts` (deterministic assessability gate keyed on `questions[].responseType` → `human_review` for unreadable/missing file answers, LLM prompt with `instructions` + isolation delimiters, 20k text / 255 filename caps, `max_tokens: 4096`, `debug_telemetry` persisted to `artifact_evaluation_flows.metadata`, `human_review` is XP-neutral, XP award failures logged not surfaced). See ADR-006.
- `lib/ai-engine/openrouter/` - OpenRouter client: 30s `AbortSignal.timeout`, one retry on 5xx/429/network, 4xx fails fast, `data.error` bodies rejected.
- `shared/` - `artifact-broker.ts` (enqueues evaluation work into the artifact broker Queue), `ai-invoker.ts` (HTTP polling helper against the broker endpoint), `logger.ts` (structured JSON logger), `schemas.ts` (Zod schema barrels), `lte-stages.ts` (stage sequence definitions).
- `api/v1/artifacts/` - Artifact submit/evaluation endpoints; extraction happens server-side at submit time (raw bytes → R2, extracted text → LLM prompt only, never stored); submitted-files listing includes `human_review`/`resubmission_required` statuses.

## Public Assets

### `public/`

Static files served directly by the frontend build.

- `assets/` - Public asset folders.
- `icons/` - Public icons.
- `images/` - Public images.
- `fonts/` - Public fonts.
- `manifest.json` - Web app manifest.
- `robots.txt` - Search crawler instructions.
- `favicon.ico` - Browser favicon.

## Documentation Structure

### `docs/`

Project reference documents.

- `architecture/` - Architecture structure documents.
- `deployment/` - Deployment documents.
- `getting-started/` - Setup and onboarding documents.
- `testing/` - Testing and coverage documents.

## Automation Structure

### `.github/`

GitHub automation and repository metadata.

- `workflows/` - CI and automation workflows.
- `ISSUE_TEMPLATE/` - Issue templates.
- `CODEOWNERS` - Ownership mapping.
- `dependabot.yml` - Dependency update configuration.

### `.husky/`

Git hook scripts.

- `pre-commit` - Pre-commit checks.
- `commit-msg` - Commit message validation.
- `pre-push` - Pre-push checks.

### `scripts/`

Utility scripts used by local setup, validation, and repository checks.
