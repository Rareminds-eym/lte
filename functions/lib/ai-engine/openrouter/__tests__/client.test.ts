import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenRouterAI } from "../client";
import { OPENROUTER_API_URL } from "../constants";

const payload = {
  model: "test-model",
  messages: [{ role: "system" as const, content: "sys" }],
  max_tokens: 4096,
};

const okResponse = (content = "ok") =>
  ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("openrouter client", () => {
  it("posts the request payload and returns the model content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse('{"decision":"pass"}'));
    vi.stubGlobal("fetch", fetchMock);

    const content = await callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload);

    expect(content).toBe('{"decision":"pass"}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OPENROUTER_API_URL);
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("retries once on 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => "rate limited",
      } as Response)
      .mockResolvedValueOnce(okResponse("retried"));

    vi.stubGlobal("fetch", fetchMock);
    const content = await callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload);

    expect(content).toBe("retried");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once on 5xx then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "down" } as Response)
      .mockResolvedValueOnce(okResponse("recovered"));

    vi.stubGlobal("fetch", fetchMock);
    const content = await callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload);

    expect(content).toBe("recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, text: async () => "bad request" } as Response);

    vi.stubGlobal("fetch", fetchMock);
    await expect(callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload)).rejects.toThrow(
      /400/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on network failure (timeout) then throws after both attempts", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));

    vi.stubGlobal("fetch", fetchMock);
    await expect(callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload)).rejects.toThrow(
      /aborted/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when the API key is missing", async () => {
    await expect(callOpenRouterAI({}, payload)).rejects.toThrow(/not configured/);
  });

  it("throws on empty response content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse("")));

    await expect(callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload)).rejects.toThrow(
      /empty response content/,
    );
  });

  it("throws without retrying when the response body carries an OpenRouter error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: { message: "insufficient_quota" } }),
    } as Response);

    vi.stubGlobal("fetch", fetchMock);
    await expect(callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload)).rejects.toThrow(
      /OpenRouter returned error: insufficient_quota/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("aborts after a 30 second timeout", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse("ok")));

    await callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload);

    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    timeoutSpy.mockRestore();
  });

  it("exhausts the single retry on persistent 5xx errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "still down",
    } as Response);

    vi.stubGlobal("fetch", fetchMock);
    await expect(callOpenRouterAI({ OPENROUTER_API_KEY: "sk-test" }, payload)).rejects.toThrow(
      /503/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
