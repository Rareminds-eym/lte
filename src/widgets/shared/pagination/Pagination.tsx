import type React from "react";
import { cn } from "@/shared/lib";
import { ChevronLeftIcon, ChevronRightIcon } from "@/shared/ui/icons";

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
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-content-secondary bg-surface-primary border border-line-default rounded-lg hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        <ChevronLeftIcon size={16} />
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
              : "text-content-secondary bg-surface-primary border border-line-default hover:bg-surface-muted",
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
        className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-content-secondary bg-surface-primary border border-line-default rounded-lg hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
      >
        Next
        <ChevronRightIcon size={16} />
      </button>
    </nav>
  );
};
