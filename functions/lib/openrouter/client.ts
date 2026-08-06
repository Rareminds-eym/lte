import type { LteEnv } from "../types";
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

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error [${response.status}]: ${await response.text()}`);
  }

  const data = (await response.json()) as OpenRouterChatResponse;
  if (data.error) throw new Error(`OpenRouter returned error: ${data.error.message}`);

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter API returned an empty response content.");

  return content;
}
