/**
 * Logging Configuration for LTE Frontend Application
 *
 * Provides structured logging with:
 * - Log levels (debug, info, warn, error)
 * - Category tagging
 * - Production level filtering
 * - Performance tracking
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  category: string;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private category: string;

  constructor(category: string) {
    this.category = category;
  }

  private shouldLog(level: LogLevel): boolean {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD) {
      return level !== "debug";
    }
    return true;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      category: this.category,
      metadata: metadata || {},
    };
  }

  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
    const metaStr =
      entry.metadata && Object.keys(entry.metadata).length > 0
        ? ` ${JSON.stringify(entry.metadata)}`
        : "";

    switch (entry.level) {
      case "debug":
        globalThis.console.debug(`${prefix} ${entry.message}${metaStr}`);
        break;
      case "info":
        globalThis.console.info(`${prefix} ${entry.message}${metaStr}`);
        break;
      case "warn":
        globalThis.console.warn(`${prefix} ${entry.message}${metaStr}`);
        break;
      case "error":
        globalThis.console.error(`${prefix} ${entry.message}${metaStr}`);
        if (entry.error?.stack) {
          globalThis.console.error(entry.error.stack);
        }
        break;
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.output(this.createEntry("debug", message, metadata));
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.output(this.createEntry("info", message, metadata));
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.output(this.createEntry("warn", message, metadata));
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    const logEntry = this.createEntry("error", message, metadata);
    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    this.output(logEntry);
  }

  timed<T>(
    message: string,
    fn: () => T | Promise<T>,
    metadata?: Record<string, unknown>,
  ): T | Promise<T> {
    const start = performance.now();

    const logCompletion = (result: T) => {
      const duration = performance.now() - start;
      this.info(`${message} completed`, { ...metadata, duration: `${duration.toFixed(2)}ms` });
      return result;
    };

    const logError = (error: Error) => {
      const duration = performance.now() - start;
      this.error(`${message} failed`, error, { ...metadata, duration: `${duration.toFixed(2)}ms` });
      throw error;
    };

    try {
      const result = fn();
      if (result instanceof Promise) {
        return result.then(logCompletion).catch(logError);
      }
      return logCompletion(result);
    } catch (error) {
      return logError(error as Error);
    }
  }
}

const loggers: Map<string, Logger> = new Map();

/**
 * Get or create a logger for a category
 */
export function getLogger(category: string): Logger {
  let logger = loggers.get(category);
  if (!logger) {
    logger = new Logger(category);
    loggers.set(category, logger);
  }
  return logger;
}

// Pre-configured loggers
export const appLogger = getLogger("app");
export const apiLogger = getLogger("api");
export const authLogger = getLogger("auth");
