import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

export async function verifyLearnerBrowserJourney(
  complete: () => Promise<Response>,
  route: (request: Request) => Promise<Response>,
) {
  const api = createServer(async (incoming, outgoing) => {
    try {
      if (incoming.method === "OPTIONS") {
        outgoing.writeHead(204, corsHeaders()).end();
        return;
      }
      const request = new Request(`http://localhost${incoming.url}`, {
        method: incoming.method,
        headers: incoming.headers as Record<string, string>,
      });
      const response = incoming.url === "/__certificate-test/complete" ? await complete() : await route(request);
      outgoing.writeHead(response.status, {
        ...Object.fromEntries(response.headers),
        ...corsHeaders(),
      });
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(500, corsHeaders()).end(error instanceof Error ? error.message : "failure");
    }
  });
  await new Promise<void>((accept, reject) => {
    api.once("error", reject);
    api.listen(0, "127.0.0.1", accept);
  });
  const address = api.address();
  assert(address && typeof address !== "string");
  const vite = spawn(
    process.execPath,
    [
      resolve(process.cwd(), "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "18791",
      "--strictPort",
      "--open",
      "false",
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_CERTIFICATE_TEST_API: `http://127.0.0.1:${address.port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let viteOutput = "";
  vite.stdout?.on("data", (chunk) => { viteOutput += String(chunk); });
  vite.stderr?.on("data", (chunk) => { viteOutput += String(chunk); });
  const browser = await chromium.launch({
    executablePath: process.env["CHROME_BIN"] || "/usr/bin/google-chrome",
    headless: true,
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        ready = (await fetch("http://127.0.0.1:18791/scripts/certificates/browser-harness.html")).ok;
      } catch {
        /* server starting */
      }
      if (vite.exitCode !== null) throw new Error("LTE Vite failed to start");
      if (ready) break;
      await delay(250);
    }
    assert(ready, "LTE browser harness must start on local port 18791");
    const browserContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await browserContext.newPage();
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    await page.goto("http://127.0.0.1:18791/scripts/certificates/browser-harness.html");
    await delay(1_000);
    assert.equal(
      await page.getByRole("button", { name: "Sign in as local learner" }).count(),
      1,
      `LTE browser harness did not mount: ${browserErrors.join(" | ")} ${await page.locator("body").innerText()} ${viteOutput}`,
    );
    await page.getByRole("button", { name: "Sign in as local learner" }).click();
    await page.getByRole("heading", { name: "Your next achievement starts here" }).waitFor().catch(async error => {
      throw new Error(`Certificate list failed: ${browserErrors.join(" | ")} ${await page.locator("body").innerText()}`, { cause: error });
    });
    await page.getByRole("button", { name: "Complete learning path" }).click();
    await page.getByRole("heading", { name: "Applied Problem Solving" }).waitFor();
    await page.getByRole("link", { name: "View certificate", exact: true }).first().click();
    await page.getByRole("article", { name: "Certificate preview" }).waitFor();
    assert.equal(await page.getByText("Sample Learner", { exact: true }).count(), 1);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download certificate" }).first().click();
    const artifact = await download;
    assert.match(artifact.suggestedFilename(), /^LTE-[0-9A-HJKMNP-TV-Z]{16}\.pdf$/);
    await page.getByText("Certificate downloaded").waitFor();
    await page.screenshot({ path: "/tmp/lte-certificate-learner-journey.png", fullPage: true });
    process.stdout.write("Local learner sign-in, completion, listing, and download browser journey passed\n");
  } finally {
    await browser.close();
    vite.kill("SIGTERM");
    api.closeAllConnections();
    await new Promise<void>((accept) => api.close(() => accept()));
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "http://127.0.0.1:18791",
    "Access-Control-Allow-Headers": "content-type, x-request-id, traceparent",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
