import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** Matches the dashboard's sun/moon control and circular theme reveal. */
export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const busy = useRef(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    const sync = (event: StorageEvent) => {
      if (event.key !== "lte-theme") return;
      const next = event.newValue === "dark";
      document.documentElement.classList.toggle("dark", next);
      document.documentElement.style.colorScheme = next ? "dark" : "light";
      setDark(next);
    };
    window.addEventListener("storage", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = async (button: HTMLButtonElement) => {
    if (busy.current) return;
    const root = document.documentElement;
    const next = !root.classList.contains("dark");
    const apply = () => {
      root.classList.toggle("dark", next);
      root.style.colorScheme = next ? "dark" : "light";
      setDark(next);
      try {
        localStorage.setItem("lte-theme", next ? "dark" : "light");
      } catch {
        /* Storage can be disabled. */
      }
    };
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply();
      return;
    }
    busy.current = true;
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    root.style.setProperty("--theme-x", `${x}px`);
    root.style.setProperty("--theme-y", `${y}px`);
    root.style.setProperty(
      "--theme-radius",
      `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`,
    );
    root.dataset["themeTransition"] = next ? "to-dark" : "to-light";
    try {
      const transition = document.startViewTransition(() => flushSync(apply));
      await transition.finished;
    } catch {
      apply();
    } finally {
      delete root.dataset["themeTransition"];
      busy.current = false;
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={dark}
      onClick={(event) => void toggle(event.currentTarget)}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <g className="theme-toggle-sun">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </g>
        <path
          className="theme-toggle-moon"
          d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"
        />
      </svg>
    </button>
  );
}
