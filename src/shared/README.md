# Shared Layer

## Description
The **Shared** layer contains reusable code, utilities, UI components, and configurations that are used across the entire application. This is the foundation layer that all other layers can import from. It should contain no business logic, only generic, reusable functionality.

## Purpose
- Provide reusable UI components (buttons, inputs, modals, etc.)
- Store application-wide configuration and constants
- Define common types and interfaces
- Provide utility functions and helpers
- Setup API clients and HTTP interceptors
- Define common hooks and custom React hooks
- Store shared assets (icons, images, fonts)

## FSD Rules

### ✅ Allowed
- **Generic UI components** (Button, Input, Modal, Card, etc.)
- **Utility functions** (date formatters, validators, etc.)
- **Configuration** (API endpoints, constants, env vars)
- **Common types** (generic TypeScript types)
- **API client** setup
- **Generic hooks** (useDebounce, useLocalStorage, etc.)
- **Assets** (icons, images, fonts)
- No imports from other layers (shared is independent)

### ❌ Not Allowed
- **Business logic** - belongs in `features` or `entities`
- **Domain-specific code** - belongs in `entities`
- **Feature implementations** - belongs in `features`
- **Page compositions** - belongs in `pages`
- Importing from: `entities`, `features`, `widgets`, `pages`, `app`

### 📦 Dependency Rules
```
shared → (no dependencies on other layers)
```
- Can import from: External libraries only
- Cannot import from: `entities`, `features`, `widgets`, `pages`, `app`

## Structure


```
src/shared/
├── README.md                      # This file
│
├── ui/                            # Reusable UI components
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.module.css
│   │   ├── Button.test.tsx
│   │   └── index.ts
│   ├── Input/
│   │   ├── Input.tsx
│   │   ├── Input.module.css
│   │   └── index.ts
│   ├── Modal/
│   │   ├── Modal.tsx
│   │   ├── Modal.module.css
│   │   └── index.ts
│   ├── Card/
│   ├── Loader/
│   ├── ErrorBoundary/
│   ├── Toast/
│   └── index.ts                  # Barrel export
│
├── api/                           # API client and utilities
│   ├── client.ts                 # Axios/Fetch client setup
│   ├── interceptors.ts           # Request/Response interceptors
│   ├── endpoints.ts              # API endpoint constants
│   ├── types.ts                  # Common API types
│   └── index.ts
│
├── config/                        # Application configuration
│   ├── constants.ts              # App-wide constants
│   ├── env.ts                    # Environment variables
│   ├── routes.ts                 # Route paths constants
│   └── index.ts
│
├── lib/                           # Utility functions
│   ├── date.ts                   # Date utilities
│   ├── string.ts                 # String utilities
│   ├── validation.ts             # Validation helpers
│   ├── formatters.ts             # General formatters
│   ├── storage.ts                # LocalStorage/SessionStorage helpers
│   └── index.ts
│
├── hooks/                         # Reusable React hooks
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useMediaQuery.ts
│   ├── useClickOutside.ts
│   ├── usePagination.ts
│   └── index.ts
│
├── types/                         # Common TypeScript types
│   ├── common.ts                 # Generic types
│   ├── api.ts                    # API-related types
│   └── index.ts
│
├── assets/                        # Static assets
│   ├── icons/                    # SVG icons
│   │   ├── CheckIcon.tsx
│   │   ├── CloseIcon.tsx
│   │   └── index.ts
│   ├── images/                   # Images
│   │   ├── logo.png
│   │   └── placeholder.png
│   └── fonts/                    # Custom fonts
│
├── schemas/                       # Validation schemas
│   ├── commonSchemas.ts          # Zod/Yup schemas
│   └── index.ts
│
└── store/                         # Shared store utilities (if using Redux)
    ├── middleware.ts             # Custom middleware
    ├── hooks.ts                  # Typed Redux hooks
    └── index.ts
```

## Usage Examples

### UI Component - Button
```tsx
// shared/ui/Button/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  children: ReactNode;
}

export const Button = ({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) => {
  const buttonClass = [
    styles.button,
    styles[variant],
    styles[size],
    loading && styles.loading,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={buttonClass}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
};
```

### API Client
```tsx
// shared/api/client.ts
import axios from 'axios';
import { API_BASE_URL } from '../config/env';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Custom Hook - useDebounce
```tsx
// shared/hooks/useDebounce.ts
import { useEffect, useState } from 'react';

export const useDebounce = <T,>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Usage
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  // Perform search with debouncedSearch
}, [debouncedSearch]);
```

### Custom Hook - useLocalStorage
```tsx
// shared/hooks/useLocalStorage.ts
import { useState, useEffect } from 'react';

export const useLocalStorage = <T,>(
  key: string,
  initialValue: T
): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
};

// Usage
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

### Utility Functions
```tsx
// shared/lib/date.ts
export const formatDate = (date: string | Date, format: string = 'MM/DD/YYYY'): string => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();

  return format
    .replace('MM', month)
    .replace('DD', day)
    .replace('YYYY', String(year));
};

export const getRelativeTime = (date: string | Date): string => {
  const now = new Date();
  const past = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
};

// shared/lib/string.ts
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const truncate = (str: string, length: number): string => {
  return str.length > length ? `${str.substring(0, length)}...` : str;
};

export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};
```

### Configuration
```tsx
// shared/config/env.ts
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'Learning Platform';
export const IS_PRODUCTION = import.meta.env.PROD;
export const IS_DEVELOPMENT = import.meta.env.DEV;

// shared/config/constants.ts
export const ITEMS_PER_PAGE = 10;
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const SUPPORTED_IMAGE_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
export const DEBOUNCE_DELAY = 300;

// shared/config/routes.ts
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  COURSES: '/courses',
  COURSE_DETAILS: '/courses/:id',
  PROFILE: '/profile',
  LOGIN: '/login',
  REGISTER: '/register',
} as const;
```

### Common Types
```tsx
// shared/types/common.ts
export type Id = string | number;

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
```

## Best Practices

1. **Generic & Reusable** - Everything in shared should be application-agnostic
2. **No Business Logic** - Keep it pure and utility-focused
3. **Well-Documented** - Document all functions and components
4. **Type-Safe** - Use TypeScript for everything
5. **Tested** - Write unit tests for utilities and components
6. **Atomic Components** - Keep UI components small and focused
7. **Composition** - Design components to be composable
8. **Accessibility** - Ensure UI components are accessible
9. **Performance** - Optimize reusable components for performance
10. **Public API** - Export clean, minimal APIs

## Common Patterns

### Compound Component Pattern
```tsx
// shared/ui/Tabs/Tabs.tsx
export const Tabs = ({ children, value, onChange }) => {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
};

Tabs.List = ({ children }) => <div className="tabs-list">{children}</div>;

Tabs.Tab = ({ value, label }) => {
  const { value: selectedValue, onChange } = useTabsContext();
  return (
    <button
      className={selectedValue === value ? 'active' : ''}
      onClick={() => onChange(value)}
    >
      {label}
    </button>
  );
};

Tabs.Panel = ({ value, children }) => {
  const { value: selectedValue } = useTabsContext();
  return selectedValue === value ? <div>{children}</div> : null;
};

// Usage
<Tabs value={activeTab} onChange={setActiveTab}>
  <Tabs.List>
    <Tabs.Tab value="1" label="Tab 1" />
    <Tabs.Tab value="2" label="Tab 2" />
  </Tabs.List>
  <Tabs.Panel value="1">Content 1</Tabs.Panel>
  <Tabs.Panel value="2">Content 2</Tabs.Panel>
</Tabs>
```

### Render Props Pattern
```tsx
// shared/ui/FetchData/FetchData.tsx
interface FetchDataProps<T> {
  url: string;
  children: (data: {
    data: T | null;
    loading: boolean;
    error: Error | null;
  }) => React.ReactNode;
}

export const FetchData = <T,>({ url, children }: FetchDataProps<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(url)
      .then((res) => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);

  return <>{children({ data, loading, error })}</>;
};
```

## Anti-Patterns to Avoid

❌ Importing from higher layers (entities, features, etc.)  
❌ Adding business-specific logic to shared utilities  
❌ Creating domain-specific components in shared/ui  
❌ Tightly coupling shared code to specific features  
❌ Duplicating code instead of creating shared utilities  
❌ Making shared components too complex  
❌ Adding feature flags or business rules to shared code  

## Component Library Standards

### Button Variants
- **Primary**: Main actions (Submit, Save, Create)
- **Secondary**: Secondary actions (Cancel, Back)
- **Danger**: Destructive actions (Delete, Remove)
- **Ghost**: Subtle actions (Edit, View)
- **Link**: Text-only actions

### Component Props Pattern
```tsx
interface ComponentProps {
  // Required props first
  children: ReactNode;
  
  // Optional props
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  
  // Event handlers
  onClick?: () => void;
  onChange?: (value: string) => void;
  
  // Style props
  className?: string;
  style?: React.CSSProperties;
  
  // HTML attributes
} & HTMLAttributes<HTMLElement>;
```

## File Naming Conventions

- **UI Components**: `ComponentName.tsx` (PascalCase)
- **Component Styles**: `ComponentName.module.css`
- **Hooks**: `useHookName.ts` (camelCase with 'use' prefix)
- **Utilities**: `utilityName.ts` (camelCase)
- **Constants**: `CONSTANT_NAME` (SCREAMING_SNAKE_CASE)
- **Types**: `types.ts` or inline with implementation
- **Index Exports**: `index.ts` for barrel exports

## Testing Shared Code

```tsx
// shared/ui/Button/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button loading>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## Related Documentation
- [FSD Official Documentation](https://feature-sliced.design/)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [Component Library Storybook](../../../storybook)
