import { type ReactNode, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { UI_INTERACTION_CLASSES, UI_TEXT } from "@/shared/config";
import { containDialogFocus } from "@/shared/lib";
import { CloseIcon } from "./icons";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Native modal behavior provides focus containment, Escape dismissal, and focus restoration. */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    dialog.showModal();
    return () => dialog.close();
  }, [open]);

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onKeyDown={(event) => {
        containDialogFocus(event);
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
      className={`dashboard-dialog m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-line-default bg-surface-primary p-6 text-content-primary shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-xs ${UI_INTERACTION_CLASSES}`}
    >
      {open && (
        <>
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={UI_TEXT.closeDialog}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-content-secondary hover:bg-surface-muted cursor-pointer"
            >
              <CloseIcon size={20} />
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>,
    document.body,
  );
}
