import { METRIC, metrics } from "../../artifact-evaluator";
import type { LteEnv } from "../../types";
import {
  DEFAULT_OPENROUTER_SITE_NAME,
  DEFAULT_OPENROUTER_SITE_URL,
  OPENROUTER_API_URL,
} from "./constants";
import type { OpenRouterChatRequest, OpenRouterChatResponse } from "./types";

export async function callOpenRouterAI(
  env: Pick<LteEnv, "OPENROUTER_API_KEY">,
  requestPayload: OpenRouterChatRequest,
): Promise<string> {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "HTTP-Referer": DEFAULT_OPENROUTER_SITE_URL,
    "X-Title": DEFAULT_OPENROUTER_SITE_NAME,
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      metrics.inc(METRIC.RETRY_COUNT);
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }

    const attemptStartedAt = performance.now();
    let response: Response;
    try {
      response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      metrics.observe(METRIC.OPENROUTER_LATENCY, Math.round(performance.now() - attemptStartedAt));
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }

    metrics.observe(METRIC.OPENROUTER_LATENCY, Math.round(performance.now() - attemptStartedAt));

    if (!response.ok) {
      const message = `OpenRouter API error [${response.status}]: ${await response.text()}`;
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(message);
        continue;
      }
      throw new Error(message);
    }

    const data = (await response.json()) as OpenRouterChatResponse;
    if (data.error) throw new Error(`OpenRouter returned error: ${data.error.message}`);

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter API returned an empty response content.");

    return content;
  }
  throw lastError ?? new Error("OpenRouter request failed.");
}
