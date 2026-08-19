# Test Structure

Tests are organized by feature first, then by responsibility:

```text
feature/responsibility/TestName.test.tsx
feature/responsibility/moduleName.test.ts
```

This keeps related coverage together while still making it clear whether a test covers API, store, UI, pages, hooks, routing, or layout behavior.

## Current Folders

```text
src/__tests__/
  auth/
    api/
    guards/
    pages/
    store/

  courses/
    components/
    pages/

  dashboard/
    api/
    hooks/
    layouts/
    pages/
    widgets/

  shared/
    barrels/
    config/
    store/
    ui/

  shell/
    app/
    errors/
    layouts/
    navigation/
    pages/
```

## Feature Folders

- `auth/`: Login, authentication state, auth API, and route guards.
- `courses/`: Course listing, course detail, and course-related components.
- `dashboard/`: Dashboard page, dashboard data, dashboard layout, and dashboard widgets.
- `shared/`: Reusable UI, shared utilities, shared stores, logging, and barrel exports.
- `shell/`: App composition, providers, router, global layout, navigation, fallback pages, and error boundaries.

## Responsibility Folders

- `api/`: Network/API behavior and API data shaping.
- `store/`: Zustand or other state store behavior.
- `pages/`: Route-level pages and page behavior.
- `components/`: Feature-owned reusable components.
- `widgets/`: Larger composed UI sections.
- `hooks/`: React hooks and query hooks.
- `layouts/`: Layout components and layout behavior.
- `guards/`: Route guard behavior.
- `navigation/`: Header, drawer, and navigation behavior.
- `app/`: App root, providers, and router composition.
- `errors/`: Error boundaries and fallback UI.
- `ui/`: Shared reusable UI primitives.
- `config/`: Shared configuration modules.
- `barrels/`: Public export and barrel contract checks.

## File Extensions

Use the extension based on the file contents:

- `.test.ts`: Logic, API, store, config, utility, and barrel tests with no JSX.
- `.test.tsx`: React component, page, layout, guard, widget, provider, and hook tests that use JSX.

Do not create `ts/` or `tsx/` folders. File extensions differentiate TypeScript from React JSX; folders should describe product ownership and responsibility.

## Naming

- Use `ComponentName.test.tsx` for React components.
- Use `PageName.test.tsx` for pages.
- Use `useHookName.test.tsx` for hooks that render through React test utilities.
- Use `moduleName.test.ts` for API, store, config, utility, and barrel tests.
- Keep the test name close to the source module name so search results are predictable.

## Placement Rules

Choose the folder by asking two questions:

1. Which feature or app area does this test protect?
2. What responsibility is being tested?

Examples:

- Auth store behavior: `auth/store/authStore.test.ts`
- Auth initialization & guards: `auth/guards/GuestGuard.test.tsx`
- Login page behavior: `auth/pages/LoginPage.test.tsx`
- Course card rendering: `courses/components/CourseCard.test.tsx`
- Dashboard data hook: `dashboard/hooks/useDashboardData.test.tsx`
- Dashboard widgets: `dashboard/widgets/DashboardWidgets.test.tsx`
- App router composition: `shell/app/AppRouter.test.tsx`
- Header navigation: `shell/navigation/Header.test.tsx`
- Shared button behavior: `shared/ui/Button.test.tsx`
- Logging config: `shared/config/logging.test.ts`

If a module is reused by multiple features and lives under `src/shared`, place its test under `shared/`.

## Import Guidelines

- Prefer project aliases such as `@/shared/ui`, `@/entities/session`, or `@/entities/dashboard`.
- Avoid deep relative imports like `../../../app/...`.
- Avoid importing from another test folder unless it is a deliberate shared test helper.
- Keep one-off mocks inside the test file that needs them.
- If a helper is reused by multiple test folders, create `src/__tests__/helpers/` and document it here.

## Adding New Tests

Do not add new test files directly under `src/__tests__` or directly under a feature root such as `src/__tests__/dashboard`.

Always place new tests under:

```text
src/__tests__/<feature>/<responsibility>/<name>.test.ts
src/__tests__/<feature>/<responsibility>/<name>.test.tsx
```

Create a new feature folder only when a new product area has enough ownership to make searches clearer.
