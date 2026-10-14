// Native Pages request/response types; no Next.js runtime dependency.
export type HttpRequest = Request & { readonly nextUrl: URL };
export type HttpResponse<T = unknown> = Response & { readonly __bodyType?: T };
export const HttpResponse = Response;

export function catalogRequest(request: Request): HttpRequest {
  return Object.assign(request, { nextUrl: new URL(request.url) });
}

export async function boundedBody(request: Request, limit: number): Promise<string> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new RangeError("Request too large");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new RangeError("Request too large");
      }
      chunks.push(decoder.decode(result.value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
  chunks.push(decoder.decode());
  return chunks.join("");
}
