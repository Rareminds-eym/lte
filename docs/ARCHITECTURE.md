# Architecture Documentation

## Overview

This document describes the architecture and design decisions for the LMS (Learning Management System) application. The project follows **Feature-Sliced Design (FSD)** methodology, a structural approach for organizing frontend applications based on business logic and scope of responsibility.

## Technology Stack

### Frontend

- **React 18.3.1** - UI library
- **TypeScript 5.5.3** - Type safety with strict mode
- **Vite 5.4.2** - Build tool and dev server
- **React Router DOM 7.9.4** - SPA client-side routing

### State Management

- **Zustand 5.0.8** - Client state management
- **TanStack Query 5.90.3** - Server state management and caching

### Styling

- **TailwindCSS 3.4.1** - Utility-first CSS framework
- **Radix UI** - Component primitives
- **Framer Motion** - Animations

### Forms & Validation

- **Zod** - Schema validation and type inference

### Backend

- **Cloudflare Pages Functions** - Serverless backend
- **Supabase 2.57.4** - Database, realtime, storage (no direct auth)

### Authentication

- **@rareminds-eym/auth-client** - Frontend authentication
- **@rareminds-eym/auth-core** - Backend authentication core

### Additional Integrations

- **Recharts** - Data visualization
- **OpenAI** - AI integration
- **Razorpay** - Payment processing

### Testing

- **Vitest 1.6.1** - Test runner
- **React Testing Library** - Component testing

### Code Quality

- **ESLint** - JavaScript/TypeScript linting (flat config)
- **Prettier** - Code formatting
- **Stylelint** - CSS linting
- **Husky** - Git hooks
- **lint-staged** - Staged files linting
- **Commitlint** - Commit message validation

### CI/CD

- **GitHub Actions** - Continuous integration
- **Docker** - Containerization
- **Nginx** - Production web server

## Architectural Methodology

### Feature-Sliced Design (FSD)

This project follows the [Feature-Sliced Design](https://feature-sliced.design/) architectural methodology. FSD provides:

✅ **Predictable structure** - Clear place for every piece of code  
✅ **Scalability** - Easy to add features without touching existing code  
✅ **Maintainability** - Easy to find and modify code  
✅ **Reusability** - Clear separation encourages code reuse  
✅ **Team collaboration** - Multiple developers can work without conflicts  
✅ **Testability** - Isolated layers are easier to test

### Layer Hierarchy

```
┌─────────────────────────────────────────┐
│                   app                    │  Application initialization
│  (providers, router, store, layouts)    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│                  pages                   │  Complete screens/routes
│     (Dashboard, CourseDetails, etc.)    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│                 widgets                  │  Composite UI blocks
│  (Header, Sidebar, CoursesList, etc.)   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│                features                  │  User interactions
│    (login, enrollment, search, etc.)    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│                entities                  │  Business entities
│      (user, course, enrollment)         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│                 shared                   │  Reusable utilities
│    (ui, api, hooks, lib, config)        │
└─────────────────────────────────────────┘
```

### Import Rules

Higher layers can import from lower layers, but not vice versa:

```
app      → pages, widgets, features, entities, shared
pages    → widgets, features, entities, shared
widgets  → features, entities, shared
features → entities, shared
entities → shared
shared   → external libraries only
```

**Critical Rules:**
- Features cannot import other features
- Entities cannot import other entities
- Shared cannot import from any internal layers

## Project Structure


```
lte/
├── .github/                    # GitHub configuration
│   ├── workflows/              # CI/CD workflows
│   │   ├── ci.yml             # Main CI pipeline
│   │   └── codeql.yml         # Security scanning
│   ├── ISSUE_TEMPLATE/        # Issue templates
│   ├── CODEOWNERS             # Code ownership
│   └── dependabot.yml         # Dependency updates
│
├── .husky/                     # Git hooks
│   ├── pre-commit             # Lint staged files
│   ├── commit-msg             # Validate commit messages
│   └── pre-push               # Run checks before push
│
├── .vscode/                    # VS Code configuration
│   ├── settings.json          # Editor settings
│   ├── extensions.json        # Recommended extensions
│   └── launch.json            # Debug configurations
│
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md        # This file
│   ├── DEPLOYMENT.md          # Deployment guide
│   ├── CODECOV_SETUP.md       # Code coverage setup
│   └── CONFIGURATION_PROTECTION.md
│
├── public/                     # Static assets
│   ├── assets/
│   │   ├── icons/
│   │   ├── images/
│   │   └── fonts/
│   ├── manifest.json
│   ├── robots.txt
│   └── favicon.ico
│
├── src/                        # Frontend source code (FSD structure)
│   ├── app/                   # Application initialization layer
│   │   ├── layouts/           # Global layouts
│   │   ├── providers/         # App-wide providers
│   │   ├── router/            # Routing configuration
│   │   │   └── guards/        # Route guards
│   │   ├── store/             # Global store setup
│   │   └── styles/            # Global styles
│   │
│   ├── pages/                 # Page components (routes)
│   │   ├── Dashboard/
│   │   ├── NotFound/
│   │   └── ...
│   │
│   ├── widgets/               # Composite UI blocks
│   │   ├── Header/
│   │   ├── Sidebar/
│   │   ├── CoursesList/
│   │   └── ...
│   │
│   ├── features/              # User-facing features
│   │   ├── authentication/
│   │   ├── course-enrollment/
│   │   ├── course-search/
│   │   └── ...
│   │
│   ├── entities/              # Business entities
│   │   ├── user/
│   │   ├── course/
│   │   ├── enrollment/
│   │   └── ...
│   │
│   ├── shared/                # Reusable code
│   │   ├── api/              # API client
│   │   ├── assets/           # Shared assets
│   │   ├── config/           # Configuration
│   │   ├── hooks/            # Reusable hooks
│   │   ├── lib/              # Utility functions
│   │   ├── schemas/          # Common schemas
│   │   ├── store/            # Store utilities
│   │   ├── types/            # Common types
│   │   └── ui/               # UI components
│   │
│   └── main.tsx              # Application entry point
│
├── functions/                 # Backend serverless functions
│   ├── auth/                 # Authentication functions
│   ├── users/                # User management
│   ├── courses/              # Course management
│   ├── enrollments/          # Enrollment functions
│   ├── notifications/        # Notification handlers
│   ├── uploads/              # File upload handlers
│   ├── middleware/           # Reusable middleware
│   ├── schemas/              # Validation schemas
│   └── shared/               # Shared utilities
│
├── scripts/                   # Utility scripts
│   ├── check-config-changes.sh
│   ├── verify-config-integrity.sh
│   └── verify-setup.sh
│
├── index.html                 # HTML entry point
├── .codereview.yml           # Code review rules
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── eslint.config.js          # ESLint configuration
├── .prettierrc               # Prettier configuration
├── .stylelintrc.json         # Stylelint configuration
├── commitlint.config.js      # Commitlint configuration
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite configuration
├── Dockerfile                # Docker configuration
├── docker-compose.yml        # Docker Compose setup
├── nginx.conf                # Nginx configuration
└── package.json              # Dependencies and scripts
```

## Layer Descriptions

### 1. App Layer (`src/app/`)

**Purpose:** Application initialization and global configuration

**Contains:**
- Application entry point and root component
- Global providers (Theme, Router, Store, Auth)
- Routing configuration and navigation guards
- Global layouts (MainLayout, AuthLayout)
- Application-wide styles and themes
- Global store configuration

**Key Files:**
- `App.tsx` - Root application component
- `providers/AppProviders.tsx` - Composed providers
- `router/AppRouter.tsx` - Routing configuration
- `store/index.ts` - Redux/Zustand store setup
- `styles/index.css` - Global styles

**Rules:**
- Only orchestrates, no business logic
- Can import from all other layers
- No feature-specific implementations

[📖 Full Documentation](../src/app/README.md)

---

### 2. Pages Layer (`src/pages/`)

**Purpose:** Complete application screens mapped to routes

**Contains:**
- Page components for each route
- Page-level data fetching
- Composition of widgets and features
- Page-specific layouts

**Examples:**
- `Dashboard/` - Main dashboard page
- `CourseDetails/` - Individual course page
- `UserProfile/` - User profile page
- `NotFound/` - 404 error page

**Rules:**
- One page per route
- Compose, don't create
- No business logic
- Import: widgets, features, entities, shared

[📖 Full Documentation](../src/pages/README.md)

---

### 3. Widgets Layer (`src/widgets/`)

**Purpose:** Composite UI blocks combining multiple features

**Contains:**
- Header, Sidebar, Footer components
- Dashboard sections
- Complex composite components
- Multi-feature UI blocks

**Examples:**
- `Header/` - Application header
- `CoursesList/` - Course list widget
- `UserProfile/` - User profile widget
- `NotificationCenter/` - Notification center

**Rules:**
- Self-contained UI blocks
- Compose features and entities
- Independent from other widgets
- Import: features, entities, shared

[📖 Full Documentation](../src/widgets/README.md)

---

### 4. Features Layer (`src/features/`)

**Purpose:** User-facing functionality and interactions

**Contains:**
- User action implementations
- Feature-specific business logic
- Feature-level state management
- API integration for features

**Examples:**
- `authentication/` - Login, register, logout
- `course-enrollment/` - Enroll in courses
- `course-search/` - Search functionality
- `profile-edit/` - Edit user profile

**Typical Structure:**
```
feature-name/
├── ui/           # Feature UI components
├── model/        # State and logic
├── api/          # API calls
├── lib/          # Feature utilities
└── index.ts      # Public exports
```

**Rules:**
- Features cannot import other features
- Named as actions (verb-based)
- Import: entities, shared only

[📖 Full Documentation](../src/features/README.md)

---

### 5. Entities Layer (`src/entities/`)

**Purpose:** Business domain models and their logic

**Contains:**
- Core business entities
- Entity CRUD operations
- Entity state management
- Entity validation schemas

**Examples:**
- `user/` - User entity
- `course/` - Course entity
- `enrollment/` - Enrollment entity
- `notification/` - Notification entity

**Typical Structure:**
```
entity-name/
├── model/        # Types, state, schemas
├── api/          # Entity API calls
├── lib/          # Entity utilities
├── ui/           # Entity display components
└── index.ts      # Public exports
```

**Rules:**
- Entities cannot import other entities
- Focus on data, not actions
- Import: shared only

[📖 Full Documentation](../src/entities/README.md)

---

### 6. Shared Layer (`src/shared/`)

**Purpose:** Reusable code without business logic

**Contains:**
- Generic UI components
- API client and utilities
- Custom React hooks
- Utility functions
- Configuration and constants
- Common types

**Subfolders:**
- `ui/` - Reusable UI components (Button, Input, Modal)
- `api/` - API client setup
- `config/` - App configuration
- `hooks/` - Generic hooks (useDebounce, useLocalStorage)
- `lib/` - Utility functions
- `schemas/` - Common validation schemas
- `types/` - Shared TypeScript types

**Rules:**
- Business-agnostic
- No domain logic
- Cannot import from other layers

[📖 Full Documentation](../src/shared/README.md)

---

### 7. Functions Layer (`functions/`)

**Purpose:** Serverless backend functions

**Contains:**
- API endpoints
- Authentication/Authorization
- Database operations
- File uploads
- Notifications
- Middleware

**Organization:**
- `auth/` - Authentication endpoints
- `users/` - User management
- `courses/` - Course operations
- `enrollments/` - Enrollment logic
- `middleware/` - Auth, validation, error handling
- `schemas/` - Backend validation
- `shared/` - Backend utilities

**Rules:**
- Backend only, no frontend imports
- Security enforcement here
- All inputs must be validated

[📖 Full Documentation](../functions/README.md)

---

## Design Principles

### 1. Separation of Concerns

Each layer has a clear responsibility:
- **App**: Initialization
- **Pages**: Route composition
- **Widgets**: UI composition
- **Features**: User actions
- **Entities**: Domain models
- **Shared**: Reusable utilities

### 2. Unidirectional Data Flow

- Data flows from higher to lower layers
- No circular dependencies
- Clear dependency tree

### 3. Single Responsibility

- Each module does one thing well
- Small, focused components
- Clear naming conventions

### 4. Don't Repeat Yourself (DRY)

- Reuse through lower layers
- Extract common logic
- Share through proper layer

### 5. Type Safety

- TypeScript everywhere
- Strict mode enabled
- Avoid `any` type
- Validation with Zod

### 6. Security First

- Frontend is not a security boundary
- All security in backend
- Validate all backend inputs
- No secrets in frontend

## State Management Strategy

### Client State (Zustand)

**Purpose:** Local UI state and client-side preferences

**Location:** 
- `entities/*/model/` - Entity state
- `features/*/model/` - Feature state

**Use Cases:**
- UI preferences (theme, sidebar collapsed)
- Local workflow state
- Form state (when not using form library)
- Temporary cross-component state

**Example:**
```typescript
// entities/user/model/userStore.ts
import { create } from 'zustand';

interface UserState {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  clearCurrentUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  clearCurrentUser: () => set({ currentUser: null }),
}));
```

### Server State (TanStack Query)

**Purpose:** Remote server data, caching, and synchronization

**Use Cases:**
- API responses
- Server data caching
- Background refetching
- Request deduplication
- Optimistic updates
- Pagination and infinite queries

**Example:**
```typescript
// entities/course/api/courseQueries.ts
import { useQuery } from '@tanstack/react-query';

export const useCourses = () => {
  return useQuery({
    queryKey: ['courses'],
    queryFn: () => apiGet('/courses'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
```

**Rule:** Don't duplicate server data in Zustand

## Authentication Architecture

### Frontend Authentication

**Package:** `@rareminds-eym/auth-client`

**Features:**
- User login/logout
- Session management
- Token refresh
- SSO integration

**Usage:**
```typescript
import { useAuthStore } from '@rareminds-eym/auth-client';

const { login, logout, user } = useAuthStore();
```

**❌ Never Use:**
- Direct `supabase.auth.*` calls
- Manual JWT handling in frontend
- Manual session management

### Backend Authentication

**Package:** `@rareminds-eym/auth-core`

**Features:**
- JWT verification
- Session validation
- Role-based access control
- API authentication middleware

**Usage:**
```typescript
import { withAuth } from '@rareminds-eym/auth-core';

export const handler = withAuth(async (req, res, auth) => {
  // auth.userId, auth.role available
});
```

### Route Guards

**Location:** `src/app/router/guards/`

**Purpose:** UI/UX only, NOT security

Guards control:
- Client-side navigation
- UI rendering
- User redirects

**Example:**
```typescript
// app/router/guards/AuthGuard.tsx
export const AuthGuard = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};
```

**Critical:** Backend must verify authentication independently

## API Communication

### Frontend API Client

**Location:** `src/shared/api/`

**Features:**
- Centralized HTTP client
- Automatic token injection
- Token refresh
- Request/response interceptors
- Error handling
- Type-safe requests

**Usage:**
```typescript
import { apiGet, apiPost } from '@/shared/api';

// GET request
const courses = await apiGet('/courses');

// POST request
const enrollment = await apiPost('/enrollments', { courseId });
```

**❌ Don't:**
- Use plain `fetch()` for backend calls
- Duplicate API logic
- Make direct database queries from frontend

### Backend API Implementation

**Location:** `functions/`

**Pattern:**
```typescript
export const handler = async (req, res) => {
  try {
    // 1. Authenticate
    const auth = await verifyAuth(req);
    
    // 2. Validate
    const data = validateSchema(req.body, schema);
    
    // 3. Authorize
    if (!canPerformAction(auth, data)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // 4. Execute
    const result = await performOperation(data);
    
    // 5. Respond
    return res.status(200).json(result);
  } catch (error) {
    return handleError(error, res);
  }
};
```

## Validation Strategy

### Frontend Validation (UX)

**Library:** Zod

**Purpose:** Improve user experience

**Location:**
- `features/*/schemas/` - Feature validation
- `entities/*/schemas/` - Entity validation
- `shared/schemas/` - Common validation

**Example:**
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'At least 6 characters'),
});
```

### Backend Validation (Security)

**Library:** Zod

**Purpose:** Mandatory security boundary

**Location:** `functions/schemas/`

**Rule:** ALWAYS validate on backend

**Example:**
```typescript
import { validateSchema } from '../middleware/validation';
import { loginSchema } from '../schemas/userSchemas';

export const login = async (req, res) => {
  const { email, password } = validateSchema(req.body, loginSchema);
  // Proceed with validated data
};
```

## Database Access

### Direct Supabase Usage

**Allowed:**
- Database queries (`supabase.from()`)
- Realtime subscriptions
- Storage operations

**Not Allowed:**
- Authentication (`supabase.auth.*`)

**Location:** Backend functions only

**Example:**
```typescript
// functions/courses/getCourses.ts
import { supabase } from '../shared/database';

export const getCourses = async () => {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('status', 'published');
    
  if (error) throw error;
  return data;
};
```

**❌ Frontend Must NOT:**
- Make direct database queries
- Access `supabase.from()` in components
- Query database from route guards

## Logging Strategy

### Development

**Allowed:**
- `console.log()` for debugging
- All log levels
- Detailed output

**Location:** Any branch except production

### Production

**Forbidden:**
- `console.log()`
- `console.info()`
- `console.debug()`

**Required:**
- Centralized logger utility
- Structured logging
- Error tracking (Sentry)

**Location:** `src/shared/lib/logger`

**Example:**
```typescript
import { logger } from '@/shared/lib/logger';

logger.info('User action', { userId, action: 'enroll' });
logger.error('API failed', { error, endpoint });
```

**CI/CD:** Block production merges with console statements

## Security Architecture

### Frontend Security

**Remember:** Frontend is NOT a security boundary

**Frontend Should:**
- Improve UX with client-side validation
- Show/hide UI based on permissions
- Redirect unauthorized users
- Validate forms before submission

**Frontend Should NOT:**
- Enforce actual permissions
- Protect sensitive data
- Trust client-side checks

### Backend Security

**Backend Must:**
- Authenticate every request
- Validate all inputs
- Authorize every action
- Sanitize data
- Rate limit requests
- Log security events

**Critical Rules:**
1. Never trust frontend data
2. Always validate on backend
3. Verify authentication on every endpoint
4. Check permissions before operations
5. Use prepared statements for SQL
6. Hash passwords with bcrypt
7. Use environment variables for secrets

### Environment Variables

**Frontend (Public):**
```env
VITE_API_URL=https://api.example.com
VITE_APP_NAME=LMS Platform
```
- Prefix with `VITE_`
- Visible in browser
- No secrets allowed

**Backend (Private):**
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
SUPABASE_SERVICE_KEY=...
```
- Never prefix with `VITE_`
- Server-side only
- Keep secrets here

## Performance Optimization

### Code Splitting

**Route-based splitting:**
```typescript
const Dashboard = lazy(() => import('@/pages/Dashboard'));
```

**Component-based splitting:**
```typescript
const HeavyWidget = lazy(() => import('@/widgets/HeavyWidget'));
```

### Memoization

```typescript
// Prevent unnecessary re-renders
const MemoizedComponent = memo(Component);

// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

### Image Optimization

- Use WebP/AVIF formats
- Lazy load images
- Responsive images with `srcset`
- Compress images before upload

### Bundle Optimization

- Tree shaking (automatic with Vite)
- Dynamic imports for large libraries
- Analyze bundle with `vite-plugin-visualizer`
- Remove unused dependencies

## Testing Strategy

### Unit Tests

**Test:**
- Utility functions
- Custom hooks
- Entity logic
- Feature logic

**Location:** `*.test.ts` next to file

**Example:**
```typescript
// shared/lib/date.test.ts
import { formatDate } from './date';

describe('formatDate', () => {
  it('formats date correctly', () => {
    expect(formatDate('2024-01-01')).toBe('01/01/2024');
  });
});
```

### Component Tests

**Test:**
- Component rendering
- User interactions
- Conditional rendering
- Props handling

**Example:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    
    expect(onClick).toHaveBeenCalledOnce();
  });
});
```

### Integration Tests

**Test:**
- Feature workflows
- API integration
- State management
- User flows

### E2E Tests

**Future consideration:**
- Playwright or Cypress
- Critical user paths
- Cross-browser testing

## Accessibility (a11y)

### Standards

- WCAG 2.1 Level AA compliance
- Semantic HTML
- ARIA attributes when needed
- Keyboard navigation
- Screen reader support
- Color contrast ratios

### Testing

- axe DevTools browser extension
- Manual keyboard navigation
- Screen reader testing (NVDA, VoiceOver)
- Automated tests with `@axe-core/react`

## Browser Support

Based on browserslist:
- Last 2 versions of major browsers
- > 0.2% market share
- Not dead browsers

## Deployment Architecture

### Development Workflow

```
Developer → Git → GitHub → CI (Lint, Test) → Preview Deploy
```

### Production Workflow

```
main branch → GitHub Actions → Build → Test → Docker → Production
```

### Environments

1. **Development** - Local environment
2. **Staging** - Pre-production testing
3. **Production** - Live application


## Monitoring and Observability

### Error Tracking

**Recommended:** Sentry, Rollbar, or Bugsnag

**Frontend:**
```typescript
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});
```

**Backend:**
```typescript
Sentry.captureException(error, {
  user: { id: userId },
  tags: { endpoint: req.url },
});
```

### Analytics

**Recommended:** Google Analytics, Mixpanel, or Plausible

**Track:**
- Page views
- User actions
- Feature usage
- Conversion funnels

### Performance Monitoring

**Tools:**
- Lighthouse CI
- Web Vitals
- Cloudflare Analytics

**Metrics:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Cumulative Layout Shift (CLS)

## File Naming Conventions

### TypeScript/TSX Files

- **Components:** `ComponentName.tsx` (PascalCase)
- **Hooks:** `useHookName.ts` (camelCase with 'use')
- **Utils:** `utilityName.ts` (camelCase)
- **Types:** `types.ts` or `ComponentName.types.ts`
- **Tests:** `ComponentName.test.tsx`

### CSS/Style Files

- **Modules:** `ComponentName.module.css`
- **Global:** `index.css`, `reset.css`
- **Themes:** `light.css`, `dark.css`

### Other Files

- **Config:** `eslint.config.js`, `vite.config.ts`
- **Documentation:** `README.md`, `ARCHITECTURE.md`
- **Exports:** `index.ts` (barrel exports)

## Code Style Guidelines

### TypeScript

```typescript
// ✅ Good
interface UserProps {
  userId: string;
  name: string;
  onUpdate: (user: User) => void;
}

export const UserProfile: React.FC<UserProps> = ({ userId, name, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  return <div>{name}</div>;
};

// ❌ Bad
export const UserProfile = (props: any) => {
  return <div>{props.name}</div>;
};
```

### Component Organization

```typescript
// 1. Imports
import { useState } from 'react';
import { Button } from '@/shared/ui';
import styles from './Component.module.css';

// 2. Types
interface Props {
  title: string;
}

// 3. Component
export const Component: React.FC<Props> = ({ title }) => {
  // 4. Hooks
  const [state, setState] = useState();
  
  // 5. Handlers
  const handleClick = () => {
    // ...
  };
  
  // 6. Render
  return <div>{title}</div>;
};
```

### Imports Order

1. External libraries (React, third-party)
2. Internal absolute imports (@/...)
3. Relative imports (./...)
4. Types
5. Styles

```typescript
// External
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Internal
import { Button } from '@/shared/ui';
import { useCourses } from '@/entities/course';

// Relative
import { CourseCard } from './CourseCard';

// Types
import type { Course } from '@/entities/course';

// Styles
import styles from './Component.module.css';
```

## Common Patterns

### Compound Component Pattern

```typescript
export const Tabs = ({ children }) => {
  const [activeTab, setActiveTab] = useState(0);
  
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
};

Tabs.List = ({ children }) => <div className="tabs-list">{children}</div>;
Tabs.Tab = ({ label, index }) => { /* ... */ };
Tabs.Panel = ({ children, index }) => { /* ... */ };

// Usage
<Tabs>
  <Tabs.List>
    <Tabs.Tab label="Tab 1" index={0} />
    <Tabs.Tab label="Tab 2" index={1} />
  </Tabs.List>
  <Tabs.Panel index={0}>Content 1</Tabs.Panel>
  <Tabs.Panel index={1}>Content 2</Tabs.Panel>
</Tabs>
```

### Custom Hook Pattern

```typescript
export const useFetchData = <T,>(url: string) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet(url);
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, loading, error };
};
```

### Render Props Pattern

```typescript
interface FetchDataProps<T> {
  url: string;
  children: (data: {
    data: T | null;
    loading: boolean;
    error: Error | null;
  }) => React.ReactNode;
}

export const FetchData = <T,>({ url, children }: FetchDataProps<T>) => {
  const { data, loading, error } = useFetchData<T>(url);
  return <>{children({ data, loading, error })}</>;
};

// Usage
<FetchData url="/courses">
  {({ data, loading, error }) => {
    if (loading) return <Loader />;
    if (error) return <Error message={error.message} />;
    return <CoursesList courses={data} />;
  }}
</FetchData>
```

## Migration Strategies

### Adding New Features

1. **Identify the layer:**
   - User action? → `features/`
   - Domain model? → `entities/`
   - Reusable UI? → `shared/ui/`

2. **Create folder structure:**
   ```
   features/new-feature/
   ├── ui/
   ├── model/
   ├── api/
   └── index.ts
   ```

3. **Implement following FSD rules**

4. **Export through index.ts**

5. **Use in higher layers**

### Refactoring Existing Code

1. **Identify current location issues**
2. **Determine correct FSD layer**
3. **Move code to proper location**
4. **Update imports**
5. **Test thoroughly**
6. **Update documentation**

## Anti-Patterns to Avoid

### ❌ Cross-Layer Violations

```typescript
// Bad: feature importing another feature
import { LoginForm } from '@/features/authentication';

// Bad: entity importing feature
import { EnrollButton } from '@/features/course-enrollment';

// Bad: shared importing entity
import { User } from '@/entities/user';
```

### ❌ Business Logic in Wrong Layer

```typescript
// Bad: business logic in shared
// shared/ui/EnrollCourseButton.tsx
export const EnrollCourseButton = ({ courseId }) => {
  const handleEnroll = async () => {
    await apiPost('/enrollments', { courseId });
    // enrollment logic here
  };
};

// Good: business logic in feature
// features/course-enrollment/ui/EnrollButton.tsx
```

### ❌ Direct Supabase Auth

```typescript
// Bad: direct Supabase auth
import { supabase } from '@/shared/api';
await supabase.auth.signInWithPassword({ email, password });

// Good: use auth client
import { useAuthStore } from '@rareminds-eym/auth-client';
await login(email, password);
```

### ❌ Skipping Backend Validation

```typescript
// Bad: frontend validation only
const handleSubmit = (data) => {
  // Frontend validates with Zod
  await apiPost('/courses', data);
};

// Good: backend also validates
export const createCourse = async (req, res) => {
  const data = validateSchema(req.body, courseSchema); // Backend validation
  // ...
};
```

## Future Considerations

### Short Term

- [ ] Implement proper logger utility
- [ ] Setup error tracking (Sentry)
- [ ] Add E2E tests
- [ ] Performance monitoring
- [ ] Accessibility audit

### Medium Term

- [ ] Internationalization (i18n)
- [ ] Progressive Web App (PWA)
- [ ] Advanced caching strategies
- [ ] Real-time features with Supabase
- [ ] Advanced analytics

### Long Term

- [ ] Micro-frontends architecture
- [ ] GraphQL integration
- [ ] Server-Side Rendering (SSR)
- [ ] Mobile app (React Native)
- [ ] AI-powered features

## Resources

### Official Documentation

- [Feature-Sliced Design](https://feature-sliced.design/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [TanStack Query](https://tanstack.com/query/latest)
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction)

### Internal Documentation

- [Contributing Guidelines](../CONTRIBUTING.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Code Review Rules](../.codereview.yml)

### Layer-Specific Docs

- [App Layer](../src/app/README.md)
- [Pages Layer](../src/pages/README.md)
- [Widgets Layer](../src/widgets/README.md)
- [Features Layer](../src/features/README.md)
- [Entities Layer](../src/entities/README.md)
- [Shared Layer](../src/shared/README.md)
- [Functions (Backend)](../functions/README.md)

## Questions and Support

### Architecture Questions

For questions about architecture decisions or FSD implementation, please:
1. Check this documentation
2. Review layer-specific README files
3. Check `.codereview.yml` for rules
4. Open a discussion on GitHub

### Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Development setup
- Coding standards
- Pull request process
- Review guidelines

### Code Reviews

All code must follow the rules defined in [`.codereview.yml`](../.codereview.yml):
- FSD layer boundaries
- Import restrictions
- Security requirements
- Authentication patterns
- Validation requirements

---

**Last Updated:** 2024  
**Architecture Version:** 1.0  
**FSD Version:** 2.0
