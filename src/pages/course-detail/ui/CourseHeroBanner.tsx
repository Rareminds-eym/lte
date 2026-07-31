import type React from "react";

export interface CourseHeroBannerProps {
  code: string;
  status: string;
  roleTitle: string;
  capabilityCode: string;
  title: string;
  description: string;
}

export const CourseHeroBanner: React.FC<CourseHeroBannerProps> = ({
  code,
  status,
  roleTitle,
  capabilityCode,
  title,
  description,
}) => {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-surface-hero p-6 sm:p-8 md:p-10 text-white shadow-xl">
      {/* Background tech grid / circuit pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.4) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-brand-600/10 blur-3xl" />

      <div className="relative z-10">
        {/* Top Tag & Status Pills */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <span className="inline-flex items-center rounded-full border border-surface-dark-border bg-surface-hero-button px-3.5 py-1 text-xs font-mono font-medium text-content-on-dark shadow-sm">
            {code}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning-500/30 bg-warning-500/10 px-3.5 py-1 text-xs font-semibold text-warning-500 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-warning-500 animate-pulse" />
            {status}
          </span>
        </div>

        {/* Subtitle / Role Context */}
        <p className="text-xs font-semibold uppercase tracking-wider text-content-on-dark-subtle mb-2">
          {roleTitle} · CAPABILITY {capabilityCode}
        </p>

        {/* Course Title */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
          {title}
        </h1>

        {/* Course Summary */}
        <p className="max-w-3xl text-sm sm:text-base text-content-on-dark leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
};
