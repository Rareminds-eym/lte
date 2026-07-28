# Pages Layer

## Description

The `pages` layer contains route-level screens. Each page slice represents one route screen and composes lower FSD layers into a complete page.

Pages should stay thin. They coordinate route params, page-only state, loading states, empty states, error states, and page-specific layout composition. Reusable business logic and reusable UI must move to lower layers.

## Strict FSD Flow

Follow this one-way dependency flow:

```text
app -> pages -> widgets -> features -> entities -> shared
```

Pages can import from:

- `widgets`
- `features`
- `entities`
- `shared`

Pages must not import from:

- `app`
- another page slice
- private internals of lower-layer slices when a public API exists

## Structure

Use lowercase FSD page slices with standard segments:

```text
src/pages/
  README.md
  index.ts

  home/
    index.ts
    ui/
      HomePage.tsx

  login/
    index.ts
    ui/
      LoginPage.tsx

  dashboard/
    index.ts
    ui/
      DashboardPage.tsx

  courses/
    index.ts
    ui/
      CoursesPage.tsx
      CourseFilterBar.tsx
      CourseResults.tsx
    model/
      courseFilters.ts

  course-detail/
    index.ts
    ui/
      CourseDetailPage.tsx

  not-found/
    index.ts
    ui/
      NotFoundPage.tsx
```

## Segment Rules

- `ui/`: Page component and page-only visual parts.
- `model/`: Page-only state helpers, filters, selectors, schemas, or small page-owned logic.
- `lib/`: Page-only helper libraries when `model/` is not the right meaning.
- `config/`: Page-only configuration.
- `api/`: Only page-owned route requests that are not reusable domain or feature behavior.

Do not create generic root folders like:

```text
src/pages/components
src/pages/hooks
src/pages/utils
```

## Public API

Every page slice must export from its own `index.ts`.

```ts
// src/pages/courses/index.ts
export { CoursesPage, CoursesPage as Courses } from "./ui/CoursesPage";
```

The root `src/pages/index.ts` can re-export page public APIs:

```ts
export { Courses, CoursesPage } from "./courses";
export { LoginPage } from "./login";
```

Other layers should import through the page public API, not through internal files:

```ts
import { Courses } from "@/pages/courses";
```

Avoid:

```ts
import { CoursesPage } from "@/pages/courses/ui/CoursesPage";
```

## Allowed

- Route-level page components.
- Page-specific UI composition.
- Page-specific loading, empty, and error states.
- Route params and search params.
- Page-only UI parts in `ui/`.
- Page-only logic in `model/` or `lib/`.
- Page-specific CSS modules next to the UI file that uses them.

## Not Allowed

- Business logic that belongs in `features` or `entities`.
- Reusable UI that belongs in `shared/ui` or `widgets`.
- Shared API clients or reusable fetch functions.
- Global stores.
- App router, app providers, app guards, app layouts, or global styles.
- Imports from another page slice.
- Shared utilities or shared constants.
- Global CSS files inside `pages`.

## CSS Rules

Page-specific CSS is allowed only inside that page slice.

Allowed:

```text
src/pages/courses/ui/CoursesPage.module.css
src/pages/courses/ui/CourseFilterBar.module.css
src/pages/login/ui/LoginPage.module.css
```

Not allowed:

```text
src/pages/styles.css
src/pages/shared.css
src/pages/courses.css
```

Move CSS out of `pages` when it becomes reusable:

- Global styles -> `src/app/styles`
- Reusable widget styles -> `src/widgets`
- Reusable UI styles -> `src/shared/ui`

## Naming

- Page slice folder: lowercase or kebab-case, for example `courses`, `course-detail`, `not-found`.
- Page component: `PageNamePage.tsx`, for example `CoursesPage.tsx`.
- Page-only UI component: PascalCase, for example `CourseFilterBar.tsx`.
- Page CSS module: same as component name, for example `CoursesPage.module.css`.
- Page model file: camelCase, for example `courseFilters.ts`.
- Public export: `index.ts`.

## Best Practices

1. Keep pages thin and composition-focused.
2. Use lower-layer hooks and components instead of adding business logic to pages.
3. Keep reusable UI outside `pages`.
4. Keep page-only UI in `ui/`.
5. Keep page-only logic in `model/` or `lib/`.
6. Use `index.ts` as the page slice public API.
7. Lazy-load pages from the app router.
8. Do not import one page slice from another.
9. If page-only code becomes reused, move it down to `widgets`, `features`, `entities`, or `shared`.

## Related Documentation

- [FSD Official Documentation](https://feature-sliced.design/)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [Routing Documentation](../app/router/README.md)
