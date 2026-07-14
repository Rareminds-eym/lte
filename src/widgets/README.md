# Widgets Layer

## Description
The **Widgets** layer contains composite UI blocks that combine multiple features and entities to create self-contained, reusable sections of the interface. Widgets are larger than features and represent complete functional blocks of a page (like header, sidebar, user card, course list, etc.).

## Purpose
- Combine features and entities into cohesive UI blocks
- Create reusable composite components used across multiple pages
- Encapsulate complex UI logic that involves multiple features
- Provide ready-to-use page sections (headers, sidebars, footers, etc.)
- Manage interactions between multiple features within a widget
- Handle widget-specific state and business logic

## FSD Rules

### ✅ Allowed
- **Composing features** into larger UI blocks
- **Using multiple entities** within a single widget
- **Widget-specific business logic** for feature coordination
- **Complex UI interactions** between features
- **Widget-level state management** (local state)
- **Responsive layouts** for widget sections
- **Integration points** for multiple features
- Import from: `features`, `entities`, `shared`

### ❌ Not Allowed
- **Direct API calls** - use features or entities
- **Global state mutations** - coordinate through features
- **Page-level routing** - belongs in `pages`
- **Application initialization** - belongs in `app`
- Importing from other `widgets` (should be independent)
- Importing from `pages` or `app`

### 📦 Dependency Rules
```
widgets → features → entities → shared
```
- Can import from: `features`, `entities`, `shared`
- Cannot import from: other `widgets`, `pages`, `app`

## Structure

```
src/widgets/
├── README.md                      # This file
│
├── Header/                        # Application header widget
│   ├── ui/
│   │   ├── Header.tsx            # Main widget component
│   │   ├── Header.module.css     # Widget styles
│   │   ├── HeaderNav.tsx         # Sub-components
│   │   └── HeaderUser.tsx
│   ├── model/                    # Widget state/logic (optional)
│   │   ├── useHeader.ts
│   │   └── types.ts
│   └── index.ts                  # Public exports
│
├── Sidebar/                       # Sidebar navigation widget
│   ├── ui/
│   │   ├── Sidebar.tsx
│   │   ├── Sidebar.module.css
│   │   └── SidebarMenu.tsx
│   ├── model/
│   │   └── useSidebar.ts
│   └── index.ts
│
├── CoursesList/                   # Courses list widget
│   ├── ui/
│   │   ├── CoursesList.tsx
│   │   ├── CourseCard.tsx
│   │   └── CoursesFilter.tsx
│   ├── model/
│   │   ├── useCoursesList.ts
│   │   └── types.ts
│   └── index.ts
│
├── UserProfile/                   # User profile widget
│   ├── ui/
│   │   ├── UserProfile.tsx
│   │   ├── UserAvatar.tsx
│   │   └── UserStats.tsx
│   ├── model/
│   │   └── useUserProfile.ts
│   └── index.ts
│
├── EnrollmentWizard/              # Multi-step enrollment widget
│   ├── ui/
│   │   ├── EnrollmentWizard.tsx
│   │   ├── Step1Info.tsx
│   │   ├── Step2Payment.tsx
│   │   └── Step3Confirm.tsx
│   ├── model/
│   │   ├── useEnrollmentWizard.ts
│   │   └── types.ts
│   └── index.ts
│
├── NotificationCenter/            # Notification center widget
│   ├── ui/
│   │   ├── NotificationCenter.tsx
│   │   ├── NotificationItem.tsx
│   │   └── NotificationCenter.module.css
│   ├── model/
│   │   └── useNotifications.ts
│   └── index.ts
│
└── index.ts                       # Barrel export (optional)
```

## Best Practices

1. **Single Purpose** - Each widget should have one clear purpose
2. **Self-Contained** - Widgets should be independent and reusable
3. **Composition** - Build widgets by composing features and entities
4. **Naming** - Use descriptive names that indicate the widget's purpose
5. **Props Interface** - Define clear and minimal props interfaces
6. **Responsive** - Make widgets responsive and adaptive
7. **Accessibility** - Ensure widgets are accessible (ARIA labels, keyboard navigation)
8. **Performance** - Optimize re-renders, use React.memo when appropriate
9. **Documentation** - Document complex widgets and their APIs
10. **Testing** - Write integration tests for widgets

## Common Patterns

### Widget Slot Pattern
```tsx
// widgets/DashboardCard/ui/DashboardCard.tsx
interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}

export const DashboardCard = ({ title, children, actions, footer }: DashboardCardProps) => {
  return (
    <Card>
      <CardHeader>
        <h3>{title}</h3>
        {actions && <div className="actions">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
};
```

### Widget with Error Boundary
```tsx
// widgets/CourseContent/ui/CourseContent.tsx
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

export const CourseContent = ({ courseId }: Props) => {
  return (
    <ErrorBoundary fallback={<CourseContentError />}>
      <CourseContentInner courseId={courseId} />
    </ErrorBoundary>
  );
};
```

## Anti-Patterns to Avoid

❌ Making direct API calls in widgets  
❌ Importing one widget from another  
❌ Putting application initialization logic in widgets  
❌ Creating overly complex widgets (split into smaller ones)  
❌ Tight coupling with specific pages  
❌ Duplicating feature logic in widgets  
❌ Using global state directly (use features)  

## Widget vs Feature vs Shared UI

| Aspect | Widget | Feature | Shared UI |
|--------|---------|---------|-----------|
| **Size** | Large composite block | Medium business slice | Small atomic component |
| **Purpose** | Page section | User action/capability | Reusable UI element |
| **Composition** | Features + Entities | Entities + Shared | Pure UI |
| **Business Logic** | Coordination logic | Core business logic | Minimal/no logic |
| **Examples** | Header, Sidebar, Dashboard Card | Login, Enrollment, Search | Button, Input, Modal |

## File Naming Conventions

- **Widget Component**: `WidgetName.tsx` (PascalCase)
- **Widget Styles**: `WidgetName.module.css` or `WidgetName.styles.ts`
- **Sub-components**: Inside `ui/` folder
- **Widget Logic**: Inside `model/` folder
- **Widget Types**: `types.ts` inside `model/` folder
- **Index Export**: `index.ts` for clean public API

## Related Documentation
- [FSD Official Documentation](https://feature-sliced.design/)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [Features Documentation](../features/README.md)
- [Shared UI Documentation](../shared/ui/README.md)
