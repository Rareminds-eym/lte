import type { KeyboardEvent } from "react";
import { FOCUSABLE_CONTROL_SELECTOR } from "@/shared/config";

export function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>): void {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_CONTROL_SELECTOR),
  ).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      (!element.hasAttribute("tabindex") || element.tabIndex >= 0),
  );
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}
