import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger, getLogger } from "@/shared/config/logging";

beforeEach(() => {
  vi.stubGlobal("console", {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
  vi.stubEnv("VITE_ENV", "test");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Logger", () => {
  it("creates logger with category", () => {
    const logger = new Logger("test-category");
    expect(logger).toBeInstanceOf(Logger);
  });

  it("logs debug messages in non-production", () => {
    const logger = new Logger("test");
    const consoleSpy = vi.spyOn(console, "debug");
    logger.debug("debug message");
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("logs info messages", () => {
    const logger = new Logger("test");
    const consoleSpy = vi.spyOn(console, "info");
    logger.info("info message");
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("logs warn messages", () => {
    const logger = new Logger("test");
    const consoleSpy = vi.spyOn(console, "warn");
    logger.warn("warn message");
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("logs error messages without error object", () => {
    const logger = new Logger("test");
    const consoleSpy = vi.spyOn(console, "error");
    logger.error("error message");
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("logs error messages with error object and stack trace", () => {
    const logger = new Logger("test");
    const consoleSpy = vi.spyOn(console, "error");
    logger.error("error message", new Error("test error"));
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it("includes metadata in log output", () => {
    const logger = new Logger("test");
    const consoleSpy = vi.spyOn(console, "info");
    logger.info("with meta", { userId: "123" });
    const callArgs = (consoleSpy.mock.calls[0] as string[])[0];
    expect(callArgs).toContain("with meta");
  });

  it("returns getLogger singleton per category", () => {
    const logger1 = getLogger("my-category");
    const logger2 = getLogger("my-category");
    expect(logger1).toBe(logger2);
  });

  it("creates new logger for different category", () => {
    const logger1 = getLogger("cat-a");
    const logger2 = getLogger("cat-b");
    expect(logger1).not.toBe(logger2);
  });

  it("filters debug messages in production mode", () => {
    const logger = new Logger("test");
    const consoleSpy = vi.spyOn(console, "debug");
    vi.stubEnv("PROD", true);
    logger.debug("should be filtered");
    expect(consoleSpy).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  describe("timed", () => {
    it("logs completion for sync function", () => {
      const logger = new Logger("test");
      const consoleSpy = vi.spyOn(console, "info");
      const result = logger.timed("operation", () => 42);
      expect(result).toBe(42);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("logs completion for async function", async () => {
      const logger = new Logger("test");
      const consoleSpy = vi.spyOn(console, "info");
      const result = await logger.timed("async-op", async () => 99);
      expect(result).toBe(99);
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("logs error for sync function that throws", () => {
      const logger = new Logger("test");
      const consoleSpy = vi.spyOn(console, "error");
      expect(() =>
        logger.timed("failing", () => {
          throw new Error("fail");
        }),
      ).toThrow("fail");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("logs error for async function that rejects", async () => {
      const logger = new Logger("test");
      const consoleSpy = vi.spyOn(console, "error");
      await expect(
        logger.timed("failing-async", async () => {
          throw new Error("async fail");
        }),
      ).rejects.toThrow("async fail");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
