/**
 * Structured logger for Cloudflare Pages Functions
 * 
 * Provides server-side logging for Cloudflare Workers/Pages Functions runtime with:
 * - Structured log formatting with timestamps
 * - Log level categorization (debug, info, warn, error)
 * - Safe JSON metadata serialization
 * - Error stack trace formatting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMetadata {
  [key: string]: unknown;
}

export class FunctionLogger {
  private category: string;

  constructor(category: string) {
    this.category = category;
  }

  private formatMessage(level: LogLevel, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.category}]`;
    
    let metaStr = '';
    if (metadata) {
      try {
        metaStr = ` ${JSON.stringify(metadata)}`;
      } catch (serializationError) {
        metaStr = ` [Metadata serialization failed: ${serializationError instanceof Error ? serializationError.message : 'Unknown error'}]`;
      }
    }
    
    return `${prefix} ${message}${metaStr}`;
  }

  debug(message: string, metadata?: LogMetadata): void {
    globalThis.console.debug(this.formatMessage('debug', message, metadata));
  }

  info(message: string, metadata?: LogMetadata): void {
    globalThis.console.info(this.formatMessage('info', message, metadata));
  }

  warn(message: string, metadata?: LogMetadata): void {
    globalThis.console.warn(this.formatMessage('warn', message, metadata));
  }

  error(message: string, error?: Error | unknown, metadata?: LogMetadata): void {
    const errorMeta = error instanceof Error 
      ? { ...(metadata || {}), error: error.message, stack: error.stack }
      : metadata;
    
    globalThis.console.error(this.formatMessage('error', message, errorMeta));
    
    if (error instanceof Error && error.stack) {
      globalThis.console.error(error.stack);
    }
  }
}

/**
 * Create a logger for a specific category
 */
export function createLogger(category: string): FunctionLogger {
  return new FunctionLogger(category);
}

// Pre-configured loggers for common use cases
export const apiLogger = createLogger('api');
export const authLogger = createLogger('auth');
export const ssoLogger = createLogger('sso');
