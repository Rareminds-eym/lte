import type React from "react";
import { cn } from "@/shared/lib";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-end gap-2", className)}>
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-content-secondary bg-surface-primary border border-gray-200 rounded-lg hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        <ChevronLeftIcon />
        Prev
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onPageChange(page)}
          aria-label={`Page ${page}`}
          aria-current={page === currentPage ? "page" : undefined}
          className={cn(
            "inline-flex items-center justify-center w-9 h-9 text-sm font-medium rounded-lg transition-colors cursor-pointer",
            page === currentPage
              ? "bg-brand-600 text-white shadow-xs"
              : "text-content-secondary bg-surface-primary border border-gray-200 hover:bg-surface-muted",
          )}
        >
          {page}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-content-secondary bg-surface-primary border border-gray-200 rounded-lg hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        Next
        <ChevronRightIcon />
      </button>
    </nav>
  );
};

const ChevronLeftIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
