# App Layer

## Description
The **App** layer is the top-level layer in the Feature-Sliced Design architecture. It contains application-wide configurations, initialization logic, global providers, routing setup, and styles. This layer orchestrates the entire application and should not contain business logic.

## Purpose
- Initialize the application and configure global settings
- Setup application-wide providers (Theme, Router, Store, Auth, etc.)
- Define global routing structure and navigation guards
- Configure global state management store
- Apply global styles and theme configurations
- Manage application lifecycle and side effects

## FSD Rules

### ✅ Allowed
- **Application initialization** and bootstrapping code
- **Global providers** (ThemeProvider, StoreProvider, RouterProvider, etc.)
- **Routing configuration** and route definitions
- **Global store setup** and root reducer configuration
- **Global styles** and CSS resets
- **Application-level error boundaries**
- **Top-level layouts** that are used across multiple pages
- Import from: `pages`, `widgets`, `features`, `entities`, `shared`

### ❌ Not Allowed
- **Business logic** - belongs in `features` or `entities`
- **UI components** - belongs in `shared/ui`, `widgets`, or `features`
- **API calls** - belongs in `shared/api` or entity/feature-specific APIs
- **Domain entities** - belongs in `entities`
- No imports from other app instances
- Direct DOM manipulation or jQuery-style code

### 📦 Dependency Rules
```
app → pages → widgets → features → entities → shared
```
- Can import from: `pages`, `widgets`, `features`, `entities`, `shared`
- Cannot import from: other `app` modules (to avoid circular dependencies)

## Structure

```
src/app/
├── App.tsx                    # Main application component
├── README.md                  # This file
│
├── layouts/                   # Global layout components
│   ├── MainLayout.tsx        # Primary application layout
│   ├── AuthLayout.tsx        # Authentication pages layout
│   └── index.ts              # Public exports
│
├── providers/                 # Application-wide context providers
│   ├── AppProviders.tsx      # Root provider composition
│   ├── ThemeProvider.tsx     # Theme/dark mode provider
│   ├── AuthProvider.tsx      # Authentication context
│   └── index.ts              # Public exports
│
├── router/                    # Routing configuration
│   ├── AppRouter.tsx         # Main router component
│   ├── routes.tsx            # Route definitions
│   ├── guards/               # Route guards and middleware
│   │   ├── AuthGuard.tsx     # Authentication guard
│   │   ├── RoleGuard.tsx     # Authorization guard
│   │   └── index.ts
│   └── index.ts
│
├── store/                     # Global state management
│   ├── index.ts              # Store configuration
│   ├── rootReducer.ts        # Root reducer combining all slices
│   ├── middleware.ts         # Custom middleware
│   └── hooks.ts              # Typed store hooks
│
└── styles/                    # Global styles
    ├── index.css             # Global CSS imports
    ├── reset.css             # CSS reset/normalize
    ├── variables.css         # CSS custom properties
    └── themes/               # Theme definitions
        ├── light.css
        └── dark.css
```

## Usage Examples

### Main App Component
```tsx
// app/App.tsx
import { AppProviders } from './providers';
import { AppRouter } from './router';
import './styles/index.css';

export const App = () => {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
};
```

### Composing Providers
```tsx
// app/providers/AppProviders.tsx
import { StoreProvider } from './StoreProvider';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from './AuthProvider';

export const AppProviders = ({ children }) => {
  return (
    <StoreProvider>
      <ThemeProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </StoreProvider>
  );
};
```

### Router Configuration
```tsx
// app/router/AppRouter.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from '@/pages/Dashboard';
import { AuthGuard } from './guards/AuthGuard';
import { MainLayout } from '@/app/layouts/MainLayout';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
```

## Best Practices

1. **Keep it thin** - App layer should only orchestrate, not implement business logic
2. **Provider composition** - Compose providers in a single component for clarity
3. **Lazy loading** - Use React.lazy() for page-level code splitting
4. **Error boundaries** - Wrap the app in error boundaries for graceful error handling
5. **Type safety** - Use TypeScript for all configuration and setup code
6. **Environment variables** - Load and validate env vars in this layer
7. **Global side effects** - Initialize analytics, monitoring, etc. here
8. **Avoid prop drilling** - Use context providers for app-wide state

## Common Files

- **App.tsx** - Root application component
- **providers/AppProviders.tsx** - Composed providers
- **router/AppRouter.tsx** - Routing configuration
- **store/index.ts** - Redux/Zustand store setup
- **styles/index.css** - Global style imports
- **layouts/MainLayout.tsx** - Main application layout

## Anti-Patterns to Avoid

❌ Adding business logic in App layer  
❌ Creating reusable components in layouts  
❌ Making API calls directly in providers  
❌ Putting feature-specific code in app layer  
❌ Creating multiple app entry points  
❌ Tight coupling between providers  

## Related Documentation
- [FSD Official Documentation](https://feature-sliced.design/)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
