# Pages Layer

## Description
The **Pages** layer represents complete application screens/routes. Each page is a composition of widgets, features, and entities that together form a complete user interface for a specific route. Pages are the entry point for routing and handle page-level concerns.

## Purpose
- Compose widgets, features, and entities into complete pages
- Handle page-level data fetching and initialization
- Define page-specific layouts and structure
- Manage page-level state and side effects
- Serve as routing targets
- Handle page-level SEO and metadata

## FSD Rules

### ✅ Allowed
- **Composing widgets** into page layouts
- **Integrating features** and their interactions on the page
- **Page-level data fetching** (using features/entities)
- **Page-specific layouts** and structure
- **Route parameters** handling
- **Page-level error handling** and loading states
- **SEO metadata** (titles, descriptions, Open Graph tags)
- Import from: `widgets`, `features`, `entities`, `shared`

### ❌ Not Allowed
- **Business logic** - belongs in `features` or `entities`
- **Reusable UI components** - belongs in `shared/ui` or `widgets`
- **API calls** - should be handled through `features` or `entities`
- **Direct state mutations** - use feature actions/services
- Importing from other `pages` (pages are independent)
- Importing from `app` layer

### 📦 Dependency Rules
```
pages → widgets → features → entities → shared
```
- Can import from: `widgets`, `features`, `entities`, `shared`
- Cannot import from: other `pages`, `app` layer

## Structure

```
src/pages/
├── README.md                      # This file
│
├── Dashboard/                     # Dashboard page
│   ├── Dashboard.tsx             # Main page component
│   ├── Dashboard.module.css      # Page-specific styles (optional)
│   └── index.ts                  # Public export
│
├── CourseDetails/                 # Course details page
│   ├── CourseDetails.tsx
│   ├── components/               # Page-specific components (if needed)
│   │   └── CourseHero.tsx
│   └── index.ts
│
├── UserProfile/                   # User profile page
│   ├── UserProfile.tsx
│   ├── hooks/                    # Page-specific hooks (optional)
│   │   └── useProfileData.ts
│   └── index.ts
│
├── Enrollment/                    # Enrollment page
│   ├── Enrollment.tsx
│   └── index.ts
│
├── Login/                         # Login page
│   ├── Login.tsx
│   └── index.ts
│
├── NotFound/                      # 404 page
│   ├── NotFound.tsx
│   └── index.ts
│
└── index.ts                       # Barrel export (optional)
```

## Best Practices

1. **Single Responsibility** - Each page should represent one route/screen
2. **Composition over Creation** - Compose existing widgets/features, don't create new ones
3. **Thin Pages** - Keep business logic in features/entities, pages should mainly compose
4. **Data Fetching** - Use feature/entity hooks for data fetching
5. **SEO Optimization** - Set page titles, meta tags, and descriptions
6. **Loading States** - Always handle loading, error, and empty states
7. **Responsive Design** - Ensure pages work on all screen sizes
8. **Code Splitting** - Use React.lazy() for lazy loading pages
9. **Naming Convention** - Use PascalCase for page folder names matching route names
10. **Independence** - Pages should be independent and not import from each other

## Common Patterns

### Page with Tabs
```tsx
export const CourseManagement = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <>
      <PageTabs value={activeTab} onChange={setActiveTab}>
        <Tab label="Overview" value="overview" />
        <Tab label="Students" value="students" />
        <Tab label="Content" value="content" />
      </PageTabs>

      {activeTab === 'overview' && <CourseOverview />}
      {activeTab === 'students' && <StudentsList />}
      {activeTab === 'content' && <ContentManager />}
    </>
  );
};
```

### Protected Page
```tsx
export const AdminDashboard = () => {
  const { user } = useAuth();

  if (!user?.isAdmin) {
    return <Navigate to="/unauthorized" />;
  }

  return (
    <div className="admin-dashboard">
      <AdminHeader />
      <AdminStats />
      <UserManagement />
    </div>
  );
};
```

### Page with SEO
```tsx
import { Helmet } from 'react-helmet-async';

export const CourseDetails = () => {
  const { course } = useCourse();

  return (
    <>
      <Helmet>
        <title>{course.title} - Learning Platform</title>
        <meta name="description" content={course.description} />
        <meta property="og:title" content={course.title} />
        <meta property="og:image" content={course.thumbnail} />
      </Helmet>

      <CourseContent course={course} />
    </>
  );
};
```

## Anti-Patterns to Avoid

❌ Implementing business logic in pages  
❌ Creating reusable components inside pages  
❌ Making direct API calls in pages  
❌ Importing one page from another  
❌ Putting too much logic in page components  
❌ Creating deeply nested component trees in pages  
❌ Duplicating widgets/features across pages instead of reusing  

## File Naming Conventions

- **Page Component**: `PageName.tsx` (PascalCase)
- **Page Styles**: `PageName.module.css` or `PageName.styles.ts`
- **Page-specific Components**: Inside `components/` subfolder
- **Page-specific Hooks**: Inside `hooks/` subfolder
- **Index Export**: `index.ts` for clean imports

## Related Documentation
- [FSD Official Documentation](https://feature-sliced.design/)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [Routing Documentation](../app/router/README.md)
