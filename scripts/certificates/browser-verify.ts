import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium, type Browser } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** Real logged-out browser + SkillPassport router + local LTE public handler. */
export async function verifyInBrowser(
  url: string,
  handler: (request: Request) => Promise<Response>,
) {
  assert.equal(new URL(url).origin, "http://localhost:18788");
  const server = createServer(async (request, response) => {
    try {
      const result = await handler(
        new Request(`http://localhost:8789${request.url}`, {
          method: request.method,
          headers: request.headers as Record<string, string>,
        }),
      );
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500).end();
    }
  });
  await new Promise<void>((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  const apiOrigin = `http://127.0.0.1:${address.port}`;
  const passport = resolve(process.cwd(), "../skillpassport");
  const vite = spawn(
    process.execPath,
    [
      resolve(passport, "node_modules/vite/bin/vite.js"),
      "--mode",
      "development",
      "--host",
      "127.0.0.1",
      "--port",
      "18788",
      "--strictPort",
    ],
    {
      cwd: passport,
      env: { ...process.env, VITE_LTE_APP_URL: apiOrigin },
      stdio: "ignore",
    },
  );
  let browser: Browser | undefined;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        ready = (await fetch("http://127.0.0.1:18788")).ok;
      } catch {
        /* server starting */
      }
      if (vite.exitCode !== null) throw new Error("SkillPassport Vite failed to start");
      if (ready) break;
      await delay(250);
    }
    assert(ready, "SkillPassport must start on local port 18788");
    browser = await chromium.launch({
      executablePath: process.env["CHROME_BIN"] || "/usr/bin/google-chrome",
      headless: true,
    });
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Verified achievement" }).waitFor();
      assert.equal(await page.getByText("Sample Learner", { exact: true }).count(), 1);
      assert.match(
        (await page.locator('meta[name="robots"]').getAttribute("content")) ?? "",
        /noindex/,
      );
      assert.equal(
        await page.locator("body").evaluate((body) => body.classList.contains("hide-zoho-widget")),
        true,
      );
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        accessibility.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          targets: nodes.map((node) => node.target),
        })),
        [],
        `${viewport.name} verification page has axe violations`,
      );
      await page.screenshot({
        path: `/tmp/lte-certificate-verify-browser-${viewport.name}.png`,
        fullPage: true,
      });
      if (viewport.name === "desktop") {
        await writeFile("/tmp/lte-certificate-verify-browser.html", await page.content());
        await page.screenshot({
          path: "/tmp/lte-certificate-verify-browser.png",
          fullPage: true,
        });
      }
      await context.close();
    }
    process.stdout.write(
      "Logged-out SkillPassport desktop/mobile browser and WCAG axe verification passed\n",
    );
  } finally {
    await browser?.close();
    vite.kill("SIGTERM");
    server.closeAllConnections();
    await new Promise<void>((accept) => server.close(() => accept()));
  }
}
