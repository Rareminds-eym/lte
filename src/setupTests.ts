import "@testing-library/jest-dom";

// Fail tests immediately if React DOM emits HTML nesting or hydration errors
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args
    .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
    .join(" ");

  if (
    message.includes("In HTML,") ||
    message.includes("cannot be a descendant of") ||
    message.includes("validateDOMNesting") ||
    message.includes("Hydration failed") ||
    message.includes("Text content does not match")
  ) {
    throw new Error(`[DOM Nesting / Hydration Error]: ${message}`);
  }

  originalConsoleError(...args);
};
