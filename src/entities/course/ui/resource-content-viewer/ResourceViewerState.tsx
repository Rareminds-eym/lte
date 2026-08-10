import type React from "react";
import { Button, DocumentIcon } from "@/shared/ui";

interface ResourceViewerStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const ResourceViewerState: React.FC<ResourceViewerStateProps> = ({
  title,
  message,
  actionLabel,
  onAction,
}) => (
  <div className="flex h-full w-full items-center justify-center bg-surface-primary p-6">
    <div className="w-full max-w-sm text-center">
      <DocumentIcon size={44} className="mx-auto text-content-muted" />
      <h3 className="mt-3 text-sm font-bold text-content-primary">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-content-secondary">{message}</p>
      {actionLabel && onAction ? (
        <Button type="button" size="sm" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  </div>
);
