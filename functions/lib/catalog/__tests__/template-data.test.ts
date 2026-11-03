import { describe, expect, it } from "vitest";
import { createHandlers } from "../template-data";
import { catalogFixture, id, MemoryDb, request } from "./fixtures";

describe("workbook data export", () => {
  it("exports the linked sample course with normalized pipe cells", async () => {
    const db = catalogFixture();
    db.tables.levels[0].observable_behavior = ["Observe", "Report"];
    db.tables.modules[0].prerequisites = ["Basics"];
    const result = await createHandlers(db.dependencies()).GET(
      request("GET", undefined, "?levelCode=CAP_L1"),
    );
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(JSON.stringify(body)).toContain("Observe");
    expect(db.calls.some((call) => call.table === "artifact_templates")).toBe(true);
  });
  it("generates a template when no sample course exists", async () => {
    const response = await createHandlers(new MemoryDb().dependencies()).GET(request());
    expect(response.status).toBe(200);
    expect(Object.keys(await response.json()).length).toBeGreaterThan(0);
  });
  it("exports by capability and reports a database failure", async () => {
    const db = catalogFixture();
    const handler = createHandlers(db.dependencies()).GET;
    expect((await handler(request("GET", undefined, `?capabilityId=${id}`))).status).toBe(200);
    db.failures.set("roles:read", "Unavailable");
    await expect(handler(request())).rejects.toThrow("Unavailable");
  });
});
