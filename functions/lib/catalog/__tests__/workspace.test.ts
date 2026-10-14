import { describe, expect, it } from "vitest";
import { createHandlers } from "../workspace";
import { catalogFixture, id, MemoryDb, request } from "./fixtures";

describe("catalog workspace views", () => {
  it.each([
    "dashboard",
    "summary",
    "capabilities",
    "roles",
    "courses",
  ])("loads the %s view with linked courses", async (view) => {
    const db = catalogFixture();
    const response = await createHandlers(db.dependencies()).GET(
      request("GET", undefined, `?view=${view}`),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });
  it.each([
    "capability_detail",
    "role_detail",
    "course_detail",
  ])("loads %s and rejects missing identities", async (view) => {
    const handler = createHandlers(catalogFixture().dependencies()).GET;
    expect((await handler(request("GET", undefined, `?view=${view}`))).status).toBe(400);
    const response = await handler(request("GET", undefined, `?view=${view}&id=${id}`));
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    expect((await handler(request("GET", undefined, `?view=${view}&id=missing`))).status).toBe(404);
  });
  it.each([
    "dashboard",
    "summary",
    "capabilities",
    "roles",
    "courses",
  ])("handles an empty %s catalog", async (view) => {
    const response = await createHandlers(new MemoryDb().dependencies()).GET(
      request("GET", undefined, `?view=${view}`),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
  });
  it.each(["capabilities", "roles"])("supports scoped/searching %s lists", async (view) => {
    const handler = createHandlers(catalogFixture().dependencies()).GET;
    for (const scope of ["all", "uploaded"]) {
      expect(
        (
          await handler(
            request("GET", undefined, `?view=${view}&scope=${scope}&search=Eng&page=1&pageSize=2`),
          )
        ).status,
      ).toBe(200);
    }
  });
  it("returns failures and rejects unknown views", async () => {
    const db = catalogFixture();
    db.failures.set("levels:read", "Database unavailable");
    expect((await createHandlers(db.dependencies()).GET(request())).status).toBe(500);
    expect(
      (await createHandlers(db.dependencies()).GET(request("GET", undefined, "?view=bad"))).status,
    ).toBe(400);
    const deps = db.dependencies();
    deps.authenticate = async () => ({ user: null, error: null });
    expect((await createHandlers(deps).GET(request())).status).toBe(401);
  });
});
