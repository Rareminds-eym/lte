import { createHash } from "node:crypto";
import { resolve4, resolve6 } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.aws.internal",
  "instance-data.ec2.internal",
]);

const MIME_BY_EXTENSION: Record<string, string[]> = {
  pdf: ["application/pdf"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
  mp4: ["video/mp4"],
  mp3: ["audio/mpeg"],
  json: ["application/json"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

const DEFAULT_SIZE_LIMIT = 25 * 1024 * 1024;
const SIZE_LIMITS: Record<string, number> = {
  "video/mp4": 100 * 1024 * 1024,
  "application/pdf": 50 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": 50 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": 50 * 1024 * 1024,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 50 * 1024 * 1024,
};

export type AssetValidationErrorCode =
  | "INVALID_URL"
  | "INVALID_PROTOCOL"
  | "BLOCKED_DOMAIN"
  | "PRIVATE_IP"
  | "DNS_RESOLUTION_FAILED"
  | "TOO_MANY_REDIRECTS"
  | "HTTP_ERROR"
  | "INVALID_MIME_TYPE"
  | "FILE_TOO_LARGE"
  | "DOWNLOAD_TIMEOUT"
  | "DOWNLOAD_FAILED"
  | "DRIVE_NOT_PUBLIC";

export class AssetValidationError extends Error {
  constructor(
    public readonly code: AssetValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AssetValidationError";
  }
}

export interface ValidatedAsset {
  originalUrl: string;
  finalUrl: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
}

export interface AssetValidationResult {
  url: string;
  valid: boolean;
  asset?: ValidatedAsset;
  errorCode?: AssetValidationErrorCode;
  error?: string;
}

export interface AssetValidatorDependencies {
  fetch: typeof fetch;
  resolve: (hostname: string) => Promise<string[]>;
}

const defaultDependencies: AssetValidatorDependencies = {
  fetch: (input, init) => fetch(input, init),
  resolve: async (hostname) =>
    (await Promise.allSettled([resolve4(hostname), resolve6(hostname)])).flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
};

function googleFileId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const docMatch = url.pathname.match(/^\/(?:presentation|spreadsheets|document)\/d\/([^/]+)/);
  const driveMatch = url.pathname.match(/^\/file\/d\/([^/]+)/);
  if (hostname === "docs.google.com" && docMatch) return docMatch[1] || null;
  if (hostname === "drive.google.com" && driveMatch) return driveMatch[1] || null;
  if (["drive.google.com", "docs.google.com"].includes(hostname)) return url.searchParams.get("id");
  return null;
}

function googleDownloadCandidates(url: URL): URL[] {
  const fileId = googleFileId(url);
  if (!fileId) return [url];

  const candidates: URL[] = [];
  if (url.hostname.toLowerCase() === "docs.google.com") {
    if (url.pathname.startsWith("/presentation/")) {
      candidates.push(new URL(`https://docs.google.com/presentation/d/${fileId}/export/pptx`));
    } else if (url.pathname.startsWith("/spreadsheets/")) {
      candidates.push(
        new URL(`https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`),
      );
    } else if (url.pathname.startsWith("/document/")) {
      candidates.push(new URL(`https://docs.google.com/document/d/${fileId}/export?format=docx`));
    }
  }

  candidates.push(
    new URL(`https://drive.google.com/uc?export=download&id=${fileId}`),
    new URL(`https://drive.google.com/uc?id=${fileId}&export=download`),
    new URL(`https://drive.google.com/file/d/${fileId}/export?format=pdf`),
  );

  return [...new Map(candidates.map((candidate) => [candidate.toString(), candidate])).values()];
}

function isPrivateIPv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 0 ||
    octets[0]! >= 224
  );
}

export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIPv4(address);
  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  )
    return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mapped ? isPrivateIPv4(mapped) : false;
}

export async function validateAssetDestination(
  urlString: string,
  dependencies: AssetValidatorDependencies = defaultDependencies,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new AssetValidationError("INVALID_URL", "Asset URL is invalid");
  }
  if (url.protocol !== "https:")
    throw new AssetValidationError("INVALID_PROTOCOL", "Asset URL must use HTTPS");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new AssetValidationError("BLOCKED_DOMAIN", `Blocked asset hostname: ${hostname}`);
  }
  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new AssetValidationError("PRIVATE_IP", `Private asset address: ${hostname}`);
  }

  let addresses: string[];
  try {
    addresses = isIP(hostname) ? [hostname] : await dependencies.resolve(hostname);
  } catch {
    throw new AssetValidationError(
      "DNS_RESOLUTION_FAILED",
      `Could not resolve asset hostname: ${hostname}`,
    );
  }
  if (addresses.length === 0)
    throw new AssetValidationError(
      "DNS_RESOLUTION_FAILED",
      `No addresses for asset hostname: ${hostname}`,
    );
  if (addresses.some(isPrivateAddress))
    throw new AssetValidationError(
      "PRIVATE_IP",
      `Hostname resolves to a private address: ${hostname}`,
    );
  return url;
}

function expectedMime(url: URL): string[] | undefined {
  const extension = url.pathname.split(".").pop()?.toLowerCase();
  return extension ? MIME_BY_EXTENSION[extension] : undefined;
}

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function validateAndStreamAsset<T>(
  originalUrl: string,
  consume: (body: ReadableStream<Uint8Array>, mimeType: string) => Promise<T>,
  options: {
    timeoutMs?: number;
    maxRedirects?: number;
    dependencies?: AssetValidatorDependencies;
  } = {},
): Promise<Omit<ValidatedAsset, "bytes"> & { result: T }> {
  const dependencies = options.dependencies || defaultDependencies;
  const timeout = timeoutSignal(options.timeoutMs ?? 30_000);
  const maxRedirects = options.maxRedirects ?? 3;
  let lastError: AssetValidationError | null = null;

  try {
    const sourceUrl = await validateAssetDestination(originalUrl, dependencies);
    const candidates = googleDownloadCandidates(sourceUrl);
    let sharingBlocked = false;

    for (const candidate of candidates) {
      let currentUrl = candidate.toString();

      for (let redirects = 0; ; redirects += 1) {
        const parsed = await validateAssetDestination(currentUrl, dependencies);
        let response: Response;
        try {
          response = await dependencies.fetch(parsed, {
            method: "GET",
            redirect: "manual",
            signal: timeout.signal,
          });
        } catch (error) {
          if (timeout.signal.aborted || (error as Error).name === "AbortError") {
            throw new AssetValidationError("DOWNLOAD_TIMEOUT", "Asset download timed out");
          }
          throw new AssetValidationError(
            "DOWNLOAD_FAILED",
            `Asset download failed: ${(error as Error).message}`,
          );
        }

        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (redirects >= maxRedirects)
            throw new AssetValidationError("TOO_MANY_REDIRECTS", "Asset redirect limit exceeded");
          const location = response.headers.get("location");
          if (!location)
            throw new AssetValidationError(
              "HTTP_ERROR",
              "Asset redirect is missing Location header",
            );
          currentUrl = new URL(location, parsed).toString();
          continue;
        }
        if (!response.ok || !response.body) {
          if ([401, 403, 404].includes(response.status)) sharingBlocked = true;
          lastError = new AssetValidationError(
            "HTTP_ERROR",
            `Asset server returned ${response.status}${response.statusText ? ` ${response.statusText}` : ""} for ${parsed.toString()}`,
          );
          break;
        }

        const mimeType = (response.headers.get("content-type") || "")
          .split(";")[0]!
          .trim()
          .toLowerCase();
        if (mimeType === "text/html") {
          // Drive serves the login/consent HTML page when the file is not public.
          sharingBlocked = true;
          lastError = new AssetValidationError(
            "DOWNLOAD_FAILED",
            `Google Drive returned an HTML page instead of the file for ${parsed.toString()}. Confirm the source file is directly downloadable without login.`,
          );
          break;
        }
        const expected = expectedMime(parsed);
        if (!mimeType || (expected && !expected.includes(mimeType))) {
          lastError = new AssetValidationError(
            "INVALID_MIME_TYPE",
            `Unexpected Content-Type: ${mimeType || "missing"} for ${parsed.toString()}`,
          );
          break;
        }
        const limit = SIZE_LIMITS[mimeType] || DEFAULT_SIZE_LIMIT;
        const declaredSize = Number(response.headers.get("content-length"));
        if (Number.isFinite(declaredSize) && declaredSize > limit) {
          throw new AssetValidationError("FILE_TOO_LARGE", `Asset exceeds ${limit} bytes`);
        }

        const reader = response.body.getReader();
        const hash = createHash("sha256");
        let sizeBytes = 0;
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            try {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              sizeBytes += value.byteLength;
              if (sizeBytes > limit)
                throw new AssetValidationError("FILE_TOO_LARGE", `Asset exceeds ${limit} bytes`);
              hash.update(value);
              controller.enqueue(value);
            } catch (error) {
              await reader.cancel().catch(() => {});
              controller.error(error);
            }
          },
          async cancel(reason) {
            await reader.cancel(reason);
          },
        });
        let result: T;
        try {
          result = await consume(body, mimeType);
        } finally {
          await reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        return {
          originalUrl,
          finalUrl: parsed.toString(),
          contentHash: hash.digest("hex"),
          mimeType,
          sizeBytes,
          result,
        };
      }
    }

    if (sharingBlocked) {
      throw new AssetValidationError(
        "DRIVE_NOT_PUBLIC",
        `Google Drive file is not publicly downloadable: ${originalUrl}. Make it public (open the file → Share → General access → "Anyone with the link" as Viewer), then republish. Last error: ${lastError?.message || "download failed"}`,
      );
    }
    throw (
      lastError ||
      new AssetValidationError(
        "DOWNLOAD_FAILED",
        "Asset download failed for every Google Drive candidate URL",
      )
    );
  } finally {
    timeout.clear();
  }
}

/** Compatibility helper for byte-oriented callers; deployed ingestion uses the sink API. */
export async function validateAndDownloadAsset(
  originalUrl: string,
  options: Parameters<typeof validateAndStreamAsset>[2] = {},
): Promise<ValidatedAsset> {
  const { result, ...asset } = await validateAndStreamAsset(
    originalUrl,
    async (body) => new Uint8Array(await new Response(body).arrayBuffer()),
    options,
  );
  return { ...asset, bytes: result };
}

export async function validateAssetBatch(
  urls: string[],
  options: {
    concurrency?: number;
    perAssetTimeoutMs?: number;
    totalTimeoutMs?: number;
    dependencies?: AssetValidatorDependencies;
  } = {},
): Promise<AssetValidationResult[]> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 10, 10));
  const deadline = Date.now() + (options.totalTimeoutMs ?? 300_000);
  const results = new Array<AssetValidationResult>(urls.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < urls.length) {
      const index = nextIndex++;
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        results[index] = {
          url: urls[index]!,
          valid: false,
          errorCode: "DOWNLOAD_TIMEOUT",
          error: "Asset batch timed out",
        };
        continue;
      }
      try {
        const asset = await validateAndDownloadAsset(urls[index]!, {
          timeoutMs: Math.min(options.perAssetTimeoutMs ?? 30_000, remaining),
          dependencies: options.dependencies,
        });
        results[index] = { url: urls[index]!, valid: true, asset };
      } catch (error) {
        const validationError =
          error instanceof AssetValidationError
            ? error
            : new AssetValidationError(
                "DOWNLOAD_FAILED",
                error instanceof Error ? error.message : String(error),
              );
        results[index] = {
          url: urls[index]!,
          valid: false,
          errorCode: validationError.code,
          error: validationError.message,
        };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}
