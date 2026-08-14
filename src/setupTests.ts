import "@testing-library/jest-dom";
import { vi } from "vitest";

// Provide an inert dev-only HMAC key for the SkillPassport gateway auth tests
// (see functions/lib/__tests__/test-secrets.ts). The value is derived at
// runtime — never committed to version control — so no secret-shaped literal
// lives in source. Both the sign and verify sides of a test read the same
// `TEST_GATEWAY_SECRET` env var within the process, so a fresh random key per
// run stays internally consistent. CI may override it via the env var.
if (!process.env["TEST_GATEWAY_SECRET"]) {
  process.env["TEST_GATEWAY_SECRET"] = globalThis.crypto.randomUUID();
}

vi.mock("@file-viewer/pptx", () => ({
  PptxViewer: () => null,
}));

vi.mock("docx-preview", () => ({
  renderAsync: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

vi.mock("xlsx", () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn(() => []) },
}));

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
