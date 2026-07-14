# Entities Layer

## Description
The **Entities** layer contains business entities that represent the core domain models of your application. Entities are business objects with their own state, logic, and data management. They are reusable across features and represent the fundamental building blocks of your domain (User, Course, Enrollment, etc.).

## Purpose
- Define core business domain models
- Manage entity-specific state and data
- Provide CRUD operations for entities
- Handle entity-level data fetching and caching
- Define entity schemas and validation
- Provide entity-specific utilities and helpers
- Serve as a single source of truth for domain data

## FSD Rules

### ✅ Allowed
- **Business domain models** (User, Course, Enrollment, etc.)
- **Entity CRUD operations**
- **Entity state management**
- **Entity-specific API calls**
- **Entity validation and schemas**
- **Entity utilities and helpers**
- **Entity types and interfaces**
- Import from: `shared` only

### ❌ Not Allowed
- **User interactions** - belongs in `features`
- **Page composition** - belongs in `pages`
- **Feature-specific logic** - belongs in `features`
- **Generic utilities** - belongs in `shared`
- Cross-entity imports (entities should be independent)
- Importing from: other `entities`, `features`, `widgets`, `pages`, `app`

### 📦 Dependency Rules
```
entities → shared
```
- Can import from: `shared` only
- Cannot import from: other `entities`, `features`, `widgets`, `pages`, `app`

## Structure


```
src/entities/
├── README.md                      # This file
│
├── user/                          # User entity
│   ├── model/
│   │   ├── types.ts              # User types and interfaces
│   │   ├── userSlice.ts          # User state management
│   │   ├── selectors.ts          # User selectors
│   │   └── schema.ts             # User validation schema
│   ├── api/
│   │   └── userApi.ts            # User API calls
│   ├── lib/
│   │   └── utils.ts              # User-specific utilities
│   ├── ui/                       # Entity UI components (optional)
│   │   ├── UserCard.tsx          # Simple user display card
│   │   └── UserAvatar.tsx        # User avatar component
│   └── index.ts                  # Public exports
│
├── course/                        # Course entity
│   ├── model/
│   │   ├── types.ts
│   │   ├── courseSlice.ts
│   │   └── schema.ts
│   ├── api/
│   │   └── courseApi.ts
│   ├── lib/
│   │   ├── formatters.ts         # Course data formatters
│   │   └── validators.ts         # Course validators
│   ├── ui/
│   │   ├── CourseCard.tsx
│   │   └── CourseBadge.tsx
│   └── index.ts
│
├── enrollment/                    # Enrollment entity
│   ├── model/
│   │   ├── types.ts
│   │   ├── enrollmentSlice.ts
│   │   └── schema.ts
│   ├── api/
│   │   └── enrollmentApi.ts
│   └── index.ts
│
├── notification/                  # Notification entity
│   ├── model/
│   │   ├── types.ts
│   │   ├── notificationSlice.ts
│   │   └── schema.ts
│   ├── api/
│   │   └── notificationApi.ts
│   └── index.ts
│
└── index.ts                       # Barrel export (optional)
```


## Best Practices

1. **Single Entity** - Each folder should represent one business entity
2. **Independence** - Entities should not depend on each other
3. **Pure Data** - Focus on data management, not complex UI logic
4. **Type Safety** - Use TypeScript for all entity definitions
5. **Validation** - Define schemas for entity validation
6. **Immutability** - Never mutate entity state directly
7. **Selectors** - Use selectors for accessing entity state
8. **Naming** - Use singular nouns for entity names (user, course, not users, courses)
9. **Public API** - Export only necessary parts via index.ts
10. **Testing** - Write unit tests for entity logic and utilities

## Common Patterns

### Entity with React Query
```tsx
// entities/course/api/courseQueries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCoursesApi, getCourseApi, createCourseApi } from './courseApi';

export const useCourses = (filters?: CourseFilters) => {
  return useQuery({
    queryKey: ['courses', filters],
    queryFn: () => getCoursesApi(filters),
  });
};

export const useCourse = (courseId: string) => {
  return useQuery({
    queryKey: ['course', courseId],
    queryFn: () => getCourseApi(courseId),
    enabled: !!courseId,
  });
};

export const useCreateCourse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCourseApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
};
```

### Entity Formatters
```tsx
// entities/course/lib/formatters.ts
import type { Course } from '../model/types';

export const formatCoursePrice = (course: Course): string => {
  return course.price === 0 ? 'Free' : `$${course.price.toFixed(2)}`;
};

export const formatCourseDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

export const formatCourseLevel = (level: CourseLevel): string => {
  const levels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
  };
  return levels[level];
};
```

## Anti-Patterns to Avoid

❌ Importing one entity from another entity  
❌ Putting feature logic in entities  
❌ Complex UI interactions in entity components  
❌ Direct DOM manipulation  
❌ Feature-specific business logic in entities  
❌ Page-level composition in entities  
❌ Tightly coupling entities together  

## Entity vs Feature

| Aspect | Entity | Feature |
|--------|--------|---------|
| **Focus** | Data & state | User interactions |
| **Scope** | Domain model | Specific action |
| **Logic** | CRUD operations | Business workflows |
| **UI** | Simple display | Complex interactions |
| **Dependencies** | Only `shared` | `entities` + `shared` |
| **Examples** | User, Course | Login, Enrollment |

## When to Create a New Entity

✅ **Create an entity when:**
- Represents a core domain concept (User, Course, Order, etc.)
- Has its own data structure and state
- Needs CRUD operations
- Used across multiple features
- Has business rules and validation

❌ **Don't create an entity when:**
- It's a UI state (use `shared/ui` or feature state)
- It's feature-specific (use `features` layer)
- It's a utility function (use `shared/lib`)
- It's derived data (compute from existing entities)

## File Naming Conventions

- **Entity Folder**: `entityName/` (singular, camelCase)
- **Entity Types**: `types.ts`
- **Entity State**: `entityNameSlice.ts` (camelCase)
- **Entity API**: `entityNameApi.ts` (camelCase)
- **Entity Selectors**: `selectors.ts`
- **Entity Schema**: `schema.ts`
- **Entity Utils**: Inside `lib/` folder
- **Entity UI**: Inside `ui/` folder
- **Index Export**: `index.ts` for clean public API

## Related Documentation
- [FSD Official Documentation](https://feature-sliced.design/)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [Features Documentation](../features/README.md)
- [Shared Documentation](../shared/README.md)
