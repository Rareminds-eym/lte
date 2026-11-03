import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { containDialogFocus } from "@/shared/lib";

describe("containDialogFocus", () => {
  it("cycles keyboard focus through visible enabled controls in both directions", () => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML =
      '<button>First</button><button disabled tabindex="0">Disabled</button><button tabindex="-1">Excluded</button><select><option>Last</option></select>';
    document.body.append(dialog);
    const first = dialog.querySelector("button") as HTMLButtonElement;
    const last = dialog.querySelector("select") as HTMLSelectElement;
    for (const element of [first, last])
      vi.spyOn(element, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
    const preventDefault = vi.fn();
    const event = (shiftKey: boolean) =>
      ({
        key: "Tab",
        shiftKey,
        currentTarget: dialog,
        preventDefault,
      }) as unknown as KeyboardEvent<HTMLDialogElement>;
    try {
      last.focus();
      containDialogFocus(event(false));
      expect(first).toHaveFocus();
      containDialogFocus(event(true));
      expect(last).toHaveFocus();
      expect(preventDefault).toHaveBeenCalledTimes(2);
    } finally {
      dialog.remove();
    }
  });
});
