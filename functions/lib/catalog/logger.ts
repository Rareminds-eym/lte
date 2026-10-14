import { FunctionLogger, type LogMetadata } from "../../shared/logger";
// Preserve the catalog handlers' (message, metadata) logging contract.
export default class CatalogLogger extends FunctionLogger {
  override error(message: string, metadata?: LogMetadata): void {
    super.error(message, undefined, metadata);
  }
}
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
