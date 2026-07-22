import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLogger } from "../shared/config/logging";

describe("logging", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  it("creates a named logger and formats log messages", () => {
    const logger = getLogger("TestModule");

    logger.info("Test message", { key: "value" });

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] [TestModule] Test message {"key":"value"}'),
    );
  });

  it("formats error logs properly", () => {
    const logger = getLogger("TestError");
    const testError = new Error("Something went wrong");

    logger.error("Operation failed", testError);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("[ERROR] [TestError] Operation failed"),
    );
  });
});
