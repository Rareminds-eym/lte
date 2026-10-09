import { NavLink, Outlet } from "react-router-dom";
import { ROUTES, UI_TEXT } from "@/shared/config";
import { BookOpenIcon, CertificateIcon } from "@/shared/ui";

export function MyLearningLayout() {
  const linkClassName = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-12 flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors sm:flex-none sm:px-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600 ${
      isActive
        ? "border-brand-600 font-bold text-brand-700"
        : "border-transparent font-medium text-content-secondary hover:border-line-default hover:text-content-primary"
    }`;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <nav aria-label={UI_TEXT.myLearning} className="flex border-b border-line-default">
        <NavLink to={ROUTES.MY_COURSES} end className={linkClassName}>
          <BookOpenIcon size={18} aria-hidden="true" />
          {UI_TEXT.coursesHeading}
        </NavLink>
        <NavLink to={ROUTES.CERTIFICATES} end className={linkClassName}>
          <CertificateIcon size={18} aria-hidden="true" />
          {UI_TEXT.certificates}
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
