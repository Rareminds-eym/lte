# Features Layer

## Description
The **Features** layer contains user-facing functionality slices that implement specific business features. Each feature represents a user action or capability (like login, enrollment, search, filtering, etc.). Features are the core of your application's interactive behavior and business logic.

## Purpose
- Implement specific user interactions and business capabilities
- Encapsulate feature-specific business logic and state
- Provide reusable feature components across pages
- Handle feature-level data fetching and mutations
- Coordinate between entities to implement business workflows
- Manage feature-specific side effects

## FSD Rules

### ✅ Allowed
- **User action implementations** (login, enroll, search, filter, etc.)
- **Feature-specific business logic**
- **Feature-level state management**
- **API integration** for feature operations
- **Feature-specific hooks** and utilities
- **Complex interactions** between entities
- Import from: `entities`, `shared`

### ❌ Not Allowed
- **Cross-feature dependencies** - features should not import other features
- **Page composition** - belongs in `pages` layer
- **Business entities** - belongs in `entities` layer
- **Generic utilities** - belongs in `shared` layer
- Importing from: other `features`, `widgets`, `pages`, `app`

### 📦 Dependency Rules
```
features → entities → shared
```
- Can import from: `entities`, `shared`
- Cannot import from: other `features`, `widgets`, `pages`, `app`

## Structure


```
src/features/
├── README.md                      # This file
│
├── authentication/                # User authentication feature
│   ├── ui/
│   │   ├── LoginForm.tsx         # Login form component
│   │   ├── RegisterForm.tsx      # Registration form
│   │   └── LoginForm.module.css  # Feature-specific styles
│   ├── model/
│   │   ├── useAuth.ts            # Authentication logic hook
│   │   ├── authSlice.ts          # Redux slice (if using Redux)
│   │   └── types.ts              # Feature types
│   ├── api/
│   │   └── authApi.ts            # Authentication API calls
│   └── index.ts                  # Public exports
│
├── course-enrollment/             # Course enrollment feature
│   ├── ui/
│   │   ├── EnrollButton.tsx
│   │   ├── EnrollmentForm.tsx
│   │   └── EnrollButton.module.css
│   ├── model/
│   │   ├── useEnrollment.ts
│   │   └── types.ts
│   ├── api/
│   │   └── enrollmentApi.ts
│   └── index.ts
│
├── course-search/                 # Course search feature
│   ├── ui/
│   │   ├── SearchBar.tsx
│   │   ├── SearchResults.tsx
│   │   └── SearchBar.module.css
│   ├── model/
│   │   ├── useSearch.ts
│   │   └── searchSlice.ts
│   └── index.ts
│
├── course-filter/                 # Course filtering feature
│   ├── ui/
│   │   ├── FilterPanel.tsx
│   │   ├── FilterChips.tsx
│   │   └── FilterPanel.module.css
│   ├── model/
│   │   ├── useFilter.ts
│   │   └── types.ts
│   └── index.ts
│
├── notifications/                 # Notification management feature
│   ├── ui/
│   │   ├── NotificationBell.tsx
│   │   ├── NotificationList.tsx
│   │   └── NotificationItem.tsx
│   ├── model/
│   │   ├── useNotifications.ts
│   │   └── notificationSlice.ts
│   ├── api/
│   │   └── notificationApi.ts
│   └── index.ts
│
├── profile-edit/                  # User profile editing feature
│   ├── ui/
│   │   ├── ProfileForm.tsx
│   │   ├── ProfileField.tsx
│   │   └── ProfileForm.module.css
│   ├── model/
│   │   ├── useProfileEdit.ts
│   │   └── validation.ts
│   ├── api/
│   │   └── profileApi.ts
│   └── index.ts
│
└── index.ts                       # Barrel export (optional)
```

## Best Practices

1. **Single Responsibility** - Each feature should handle one specific user action
2. **Self-Contained** - Features should be independent and not rely on other features
3. **Public API** - Export only necessary components/hooks via index.ts
4. **Naming** - Use verb-based names that describe the action (login, enroll, search)
5. **Headless First** - Separate business logic from UI when possible
6. **Error Handling** - Handle errors gracefully within features
7. **Loading States** - Always expose loading states for async operations
8. **Type Safety** - Define clear TypeScript interfaces for feature data
9. **Testing** - Write unit tests for feature logic
10. **Documentation** - Document complex features and their APIs

## Common Patterns

### Compound Component Pattern
```tsx
// features/course-filter/ui/FilterPanel.tsx
export const FilterPanel = ({ children }) => {
  return <div className="filter-panel">{children}</div>;
};

FilterPanel.Category = ({ title, children }) => (
  <div className="filter-category">
    <h4>{title}</h4>
    {children}
  </div>
);

FilterPanel.Checkbox = ({ label, checked, onChange }) => (
  <label>
    <input type="checkbox" checked={checked} onChange={onChange} />
    {label}
  </label>
);

// Usage
<FilterPanel>
  <FilterPanel.Category title="Level">
    <FilterPanel.Checkbox label="Beginner" />
    <FilterPanel.Checkbox label="Intermediate" />
  </FilterPanel.Category>
</FilterPanel>
```

### Render Props Pattern
```tsx
export const Search = ({ children }) => {
  const { query, setQuery, results, isLoading } = useSearch();

  return children({ query, setQuery, results, isLoading });
};

// Usage
<Search>
  {({ query, setQuery, results, isLoading }) => (
    <>
      <SearchInput value={query} onChange={setQuery} />
      {isLoading ? <Loader /> : <SearchResults results={results} />}
    </>
  )}
</Search>
```

## Anti-Patterns to Avoid

❌ Importing one feature from another feature  
❌ Creating page-level compositions in features  
❌ Putting business entities in features (use `entities` layer)  
❌ Making features too large (split into smaller features)  
❌ Tight coupling between features  
❌ Generic utilities in features (use `shared` layer)  
❌ Direct DOM manipulation  

## Feature Size Guidelines

**Too Small** (should be in shared/ui):
- Single button with no business logic
- Pure UI component

**Just Right**:
- Login form with authentication logic
- Search bar with search logic
- Enrollment button with enrollment flow

**Too Large** (should be split):
- Entire user profile management (split into profile-edit, avatar-upload, etc.)
- Complete course management system

## File Naming Conventions

- **Feature Component**: `FeatureName.tsx` (PascalCase)
- **Feature Hook**: `useFeatureName.ts` (camelCase with 'use' prefix)
- **Feature Slice**: `featureNameSlice.ts` (camelCase)
- **Feature API**: `featureNameApi.ts` (camelCase)
- **Feature Types**: `types.ts`
- **Index Export**: `index.ts` for clean public API

## Related Documentation
- [FSD Official Documentation](https://feature-sliced.design/)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [Entities Documentation](../entities/README.md)
- [Shared Documentation](../shared/README.md)
