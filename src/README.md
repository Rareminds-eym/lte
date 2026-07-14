# Source Code Architecture

This project follows the **Feature-Sliced Design (FSD)** architecture methodology. FSD is a structural methodology for organizing frontend applications based on business logic and scope of responsibility.

## Directory Structure

```
src/
├── app/            # Application initialization layer
├── pages/          # Page components (routes)
├── widgets/        # Composite UI blocks
├── features/       # User-facing features
├── entities/       # Business entities
├── shared/         # Reusable code
└── main.tsx        # Application entry point
```

## Layer Hierarchy & Dependencies

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

## Layer Descriptions

### 🚀 App Layer
**Purpose**: Application initialization and global configuration

**Contains**:
- Application entry point and root component
- Global providers (Theme, Router, Store, Auth)
- Routing configuration and navigation guards
- Global layouts and error boundaries
- Application-wide styles and themes

**Dependencies**: Can import from all layers

**[Read More →](./app/README.md)**

---

### 📄 Pages Layer
**Purpose**: Complete application screens mapped to routes

**Contains**:
- Page components for each route
- Page-level data fetching and initialization
- Composition of widgets and features
- Page-specific layouts and structure

**Dependencies**: `widgets`, `features`, `entities`, `shared`

**[Read More →](./pages/README.md)**

---

### 🧩 Widgets Layer
**Purpose**: Composite UI blocks combining multiple features

**Contains**:
- Header, Sidebar, Footer components
- Dashboard cards and panels
- Complex composite components
- Multi-feature UI blocks

**Dependencies**: `features`, `entities`, `shared`

**[Read More →](./widgets/README.md)**

---

### ⚡ Features Layer
**Purpose**: User-facing functionality and interactions

**Contains**:
- Authentication (login, register, logout)
- Course enrollment flow
- Search and filtering functionality
- Profile editing
- Notification management

**Dependencies**: `entities`, `shared`
**Important**: Features cannot import other features

**[Read More →](./features/README.md)**

---

### 🎯 Entities Layer
**Purpose**: Business domain models and their logic

**Contains**:
- User entity (types, API, state)
- Course entity
- Enrollment entity
- Notification entity
- Entity CRUD operations and data management

**Dependencies**: `shared` only
**Important**: Entities cannot import other entities

**[Read More →](./entities/README.md)**

---

### 🔧 Shared Layer
**Purpose**: Reusable code without business logic

**Contains**:
- UI components (Button, Input, Modal, etc.)
- API client and HTTP utilities
- Custom React hooks
- Utility functions and helpers
- Configuration and constants
- Common types and interfaces

**Dependencies**: External libraries only (no internal imports)

**[Read More →](./shared/README.md)**

---

## Key FSD Principles

### 1. **Layered Architecture**
Higher layers can import from lower layers, but not vice versa.

```
app → pages → widgets → features → entities → shared
```

### 2. **Feature Isolation**
Features are independent and cannot import from each other.

```
✅ features/login → entities/user
❌ features/login → features/profile
```

### 3. **Entity Independence**
Entities are independent business models that don't depend on each other.

```
✅ entities/user → shared/api
❌ entities/user → entities/course
```

### 4. **Shared Foundation**
Shared layer has no dependencies on other application layers.

```
✅ shared/ui/Button → external libraries
❌ shared/ui/Button → entities/user
```

## Import Rules Summary

| Layer | Can Import From |
|-------|----------------|
| `app` | `pages`, `widgets`, `features`, `entities`, `shared` |
| `pages` | `widgets`, `features`, `entities`, `shared` |
| `widgets` | `features`, `entities`, `shared` |
| `features` | `entities`, `shared` |
| `entities` | `shared` |
| `shared` | External libraries only |

## File Naming Conventions

- **Components**: `ComponentName.tsx` (PascalCase)
- **Styles**: `ComponentName.module.css` or `ComponentName.styles.ts`
- **Hooks**: `useHookName.ts` (camelCase with 'use' prefix)
- **Utils**: `utilityName.ts` (camelCase)
- **Types**: `types.ts`
- **API**: `entityNameApi.ts` (camelCase)
- **State**: `entityNameSlice.ts` (camelCase)
- **Exports**: `index.ts` (barrel exports)

## Quick Reference

### When to create in...

**app/** - Application initialization, global providers, routing setup  
**pages/** - New routes, complete screens  
**widgets/** - Composite UI blocks used across pages  
**features/** - User actions and interactions (login, search, filter)  
**entities/** - Business domain models (user, course, order)  
**shared/** - Reusable UI components, utilities, hooks  

## Benefits of FSD

✅ **Predictable structure** - Clear place for every piece of code  
✅ **Scalability** - Easy to add new features without touching existing code  
✅ **Maintainability** - Easy to find and modify code  
✅ **Reusability** - Clear separation encourages code reuse  
✅ **Team collaboration** - Multiple developers can work without conflicts  
✅ **Testability** - Isolated layers are easier to test  

## Additional Resources

- [FSD Official Documentation](https://feature-sliced.design/)
- [Project Architecture Documentation](../docs/ARCHITECTURE.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

## Getting Started

1. Read the layer-specific READMEs for detailed information
2. Follow the import rules strictly
3. Keep features independent
4. Use TypeScript for type safety
5. Write tests for your code

For questions or clarifications, refer to the individual layer documentation or reach out to the team.
