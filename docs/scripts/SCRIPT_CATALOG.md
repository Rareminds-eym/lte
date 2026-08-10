# Script Catalog

Enforcement scripts derived from the `.codereview.yml` architecture and review rules.
All scripts follow the walker pattern of `scripts/detect-console-usage.js`
(traverse `src/` + `functions/`, collect violations, exit 0/1).

| # | Script | Purpose |
|---|--------|---------|
| 1 | `validate-fsd-boundaries.js` | Enforces FSD rules: slice public APIs via `index.ts` (no deep imports), approved slice segments (`ui/`, `model/`, `api/`, `lib/`, `config/`, `schemas/`), no page-slice folders like `src/pages/components/`, `src/pages/hooks/`, `src/pages/utils/`, and kebab-case directory naming. |
| 2 | `validate-runtime-separation.js` | Enforces strict frontend/backend separation (critical rule). Flags any import from `@functions/` inside `src/` and any import from `@/` or `src/` inside `functions/`. Also flags shared types crossing runtime boundaries by direct import. |
| 3 | `validate-api-client.js` | Restricts raw `fetch()` calls in frontend code. All backend communication must go through `shared/api` clients (`apiGet`/`apiPost`/`apiFetch`/`ssoClient`). Allowlists `src/shared/api/client.ts` and `src/shared/api/authApi.ts` themselves. |
| 4 | `validate-image-components.js` | Bans raw HTML `<img>` tags outside `src/shared/ui/Image.tsx`. All images must use the shared `Image` component. Excludes test files and the component itself. |
| 5 | `validate-design-tokens.js` | Bans ad-hoc/hardcoded color utilities (e.g. `bg-[#2563EB]`, `text-[#1D4ED8]`, `border-[#E5E7EB]`). All colors must come from global semantic design tokens in `@theme` / `tailwind.config.ts`. |
| 6 | `validate-state-boundaries.js` | Enforces Zustand vs TanStack Query separation: server responses must not be copied into Zustand, Zustand stores must live near owning domain, and every `useQuery` queryKey must include `userId` or `isAuthenticated` for per-user cache partitioning. |
| 7 | `validate-empty-catch.js` | Flags empty or silent `catch {}` blocks with no logging, `return`, or `throw`. Every catch must log via the centralized logger (`logger.error`) or take a visible action. |
| 8 | `validate-naming-conventions.js` | Enforces kebab-case for directories and PascalCase/camelCase for components/files. Catches nested capitalized folders (e.g. `src/widgets/dashboard/CareerPaths/`) despite kebab-case top-level slices. |
| 9 | `validate-endpoint-versioning.js` | Verifies every backend route lives under `/api/v1/` and every frontend `fetch`/`apiFetch` URL to project backends starts with `/api/v1`. Flags unversioned or hardcoded backend endpoints. |
| 10 | `validate-secret-hygiene.js` | Detects secret/key exposure to the frontend: `VITE_`-prefixed secrets, service-role keys, `createServiceSupabase`/`supabase` leaks inside `src/`, and hardcoded credentials. Complements `.secretlint`. |
| 11 | `validate-route-lazy.js` | Enforces `React.lazy()` + dynamic `import()` for all route-level page imports in `AppRouter.tsx`. Static page imports at the router level are violations. Flags missing `<Suspense>` with `<PageLoader message="...">` fallbacks. |
| 12 | `validate-test-layout.js` | Enforces the approved test structure: tests under `src/__tests__/<feature>/<responsibility>/` (e.g. `auth/api/`, `dashboard/pages/`). Test files directly under `src/__tests__/` or under an old flat structure are violations. |
| 13 | `validate-toaster-placement.js` | Enforces the global Toaster pattern: `<Toaster />` must remain registered only at the root provider layer (`AppProviders.tsx`). Local `<Toaster />` mounts in layouts, pages, features, or widgets are violations. |
| 14 | `validate-service-binding.js` | Enforces typed Service Binding RPC for cross-worker communication: `env.SSO_SERVICE.<method>()` instead of direct REST HTTP calls. Method calls must be typed via `SsoRpcService` in `functions/shared/types.ts`. |
| 15 | `validate-zod-boundaries.js` | Enforces mandatory Zod schema validation at all boundaries. Every backend handler must `safeParse` request body, params, and query with a Zod schema before any DB/business operation; schemas must be placed near ownership (`features/*/schemas/`, `entities/*/schemas/`, `functions/schemas/`), not in one central dumping ground. |
| 16 | `validate-import-aliases.js` | Enforces the `@/` path alias for all project imports under `src/`. Flags relative path navigation across FSD slices (e.g. `../../../shared/ui/Button`) and non-alias project imports. `functions/` code must use the `@functions/` alias. |