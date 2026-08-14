import { createServiceSupabase } from "@functions/lib/supabase";
import type { LteEnv, PagesContext } from "@functions/lib/types";
import { AuthError, requireAuth } from "@functions/middleware";
import type { AuthUser } from "@rareminds-eym/auth-core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestGet, onRequestPut } from "../profile";

vi.mock("@functions/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@functions/middleware")>();
  return { ...actual, requireAuth: vi.fn() };
});

vi.mock("@functions/lib/supabase", () => ({ createServiceSupabase: vi.fn() }));

const mockUser: AuthUser = {
  sub: "user-uuid-1234",
  email: "learner@rareminds.com",
  org_id: "org-1",
  roles: ["learner"],
  products: ["lte"],
  membership_status: "active",
  is_email_verified: true,
  user_metadata: {},
};

interface UsersChain extends Record<string, unknown> {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

function usersChain(readData: unknown, readError: unknown = null, writeError: unknown = null) {
  const chain: UsersChain = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    update: vi.fn().mockImplementation(() => chain),
    single: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: readData, error: readError }),
    // biome-ignore lint/suspicious/noThenProperty: mock promise resolution
    then: (resolve: (val: unknown) => unknown) =>
      Promise.resolve({ data: readData, error: writeError ?? readError }).then(resolve),
  };
  return chain;
}

function context(method: "GET" | "PUT", body?: Record<string, unknown>) {
  return {
    request: new Request("http://localhost/api/v1/settings/profile", {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    env: {} as LteEnv,
  } as PagesContext<LteEnv>;
}

const dbUser = {
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@rareminds.com",
  phone: "+91 99999 00000",
  metadata: {
    program: "BCA",
    gradeSemester: "3",
    college: "RareMinds College",
    section: "A",
    learnerId: "L-001",
    skillPassportVerified: true,
    twoFactorEnabled: true,
    loginAlertsEnabled: true,
  },
};

describe("GET /api/v1/settings/profile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestGet(context("GET"));
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireAuth throws FORBIDDEN", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Forbidden", "FORBIDDEN"));
    const response = await onRequestGet(context("GET"));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns the profile from the users table", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const chain = usersChain(dbUser);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestGet(context("GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile).toEqual({
      fullName: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@rareminds.com",
      phone: "+91 99999 00000",
      program: "BCA",
      gradeSemester: "3",
      learnerId: "L-001",
      college: "RareMinds College",
      section: "A",
      skillPassportVerified: true,
      twoFactorEnabled: true,
      loginAlertsEnabled: true,
      profileStrength: 100,
    });
  });

  it("falls back to user_metadata when the db user is missing", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      ...mockUser,
      user_metadata: {
        firstName: "Meta",
        lastName: "User",
        phone: "1112223333",
        program: "MCA",
        section: "B",
        skill_passport_verified: true,
      },
    });
    const chain = usersChain(null);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestGet(context("GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.fullName).toBe("Meta User");
    expect(body.profile.email).toBe("learner@rareminds.com");
    expect(body.profile.learnerId).toBe("user-uuid-1234");
    expect(body.profile.skillPassportVerified).toBe(true);
    expect(body.profile.twoFactorEnabled).toBe(false);
    expect(body.profile.profileStrength).toBe(75);
  });

  it("returns empty fields when nothing is available", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const chain = usersChain(null);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestGet(context("GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.fullName).toBe("");
    expect(body.profile.learnerId).toBe("user-uuid-1234");
    expect(body.profile.profileStrength).toBe(25);
  });

  it("returns an empty email when neither source has one", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ ...mockUser, email: "" });
    const chain = usersChain(null);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestGet(context("GET"));
    const body = await response.json();
    expect(body.profile.email).toBe("");
  });

  it("falls back to the auth email when the db email is empty", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({ ...mockUser, email: "auth@rareminds.com" });
    const chain = usersChain({ first_name: "A", last_name: "B", email: "", metadata: {} });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestGet(context("GET"));
    const body = await response.json();
    expect(body.profile.email).toBe("auth@rareminds.com");
  });

  it("falls back to a single full_name in metadata", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      ...mockUser,
      user_metadata: { full_name: "Meta Full" },
    });
    const chain = usersChain(null);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestGet(context("GET"));
    const body = await response.json();
    expect(body.profile.fullName).toBe("Meta Full");
  });

  it("returns 500 when the db read fails", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const chain = usersChain(null, new Error("db down"));
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestGet(context("GET"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("SERVER_ERROR");
    expect(body.error.message).toBe("Internal server error");
  });

  it("does not leak internal error details on 500", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const chain = usersChain(null, "db down");
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestGet(context("GET"));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toBe("Internal server error");
    expect(body.error.message).not.toContain("db down");
  });
});

describe("PUT /api/v1/settings/profile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(requireAuth).mockResolvedValue(mockUser);
  });

  it("returns 401 when requireAuth throws", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Missing token", "UNAUTHORIZED"));
    const response = await onRequestPut(context("PUT", { fullName: "Jane Doe" }));
    expect(response.status).toBe(401);
  });

  it("returns 403 when requireAuth throws FORBIDDEN", async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new AuthError("Forbidden", "FORBIDDEN"));
    const response = await onRequestPut(context("PUT", { fullName: "Jane Doe" }));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 400 when a field has an invalid type", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const response = await onRequestPut(context("PUT", { twoFactorEnabled: "yes" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when the body contains unknown keys", async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce(mockUser);
    const response = await onRequestPut(context("PUT", { admin: true }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("splits fullName and merges metadata", async () => {
    const existing = {
      first_name: "Old",
      last_name: "Name",
      phone: "999",
      metadata: { program: "BCA" },
    };
    const chain = usersChain(existing);
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPut(context("PUT", { fullName: "Jane Doe" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.fullName).toBe("Jane Doe");
    expect(body.profile.firstName).toBe("Jane");
    expect(body.profile.lastName).toBe("Doe");
    expect(body.profile.program).toBe("BCA");
    expect(body.profile.loginAlertsEnabled).toBe(true);

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Jane",
        last_name: "Doe",
        phone: "999",
        metadata: expect.objectContaining({ program: "BCA" }),
      }),
    );
  });

  it("accepts explicit first and last name fields", async () => {
    const chain = usersChain({ first_name: null, last_name: null, metadata: {} });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPut(context("PUT", { firstName: "Jane", lastName: "Doe" }));
    expect(response.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: "Jane", last_name: "Doe" }),
    );
  });

  it("keeps existing values when the body is empty", async () => {
    const chain = usersChain({ first_name: "Old", last_name: "Name", phone: "999", metadata: {} });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPut(context("PUT", {}));
    expect(response.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ first_name: "Old", last_name: "Name", phone: "999" }),
    );
  });

  it("handles an existing user without metadata", async () => {
    const chain = usersChain({ first_name: "Old", last_name: "Name", phone: "999" });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPut(context("PUT", {}));
    expect(response.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.any(Object) }),
    );
  });

  it("persists all provided metadata fields", async () => {
    const chain = usersChain({ first_name: "Old", last_name: "Name", phone: "999", metadata: {} });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPut(
      context("PUT", {
        phone: "555 1234",
        program: "BSc",
        gradeSemester: "5",
        college: "RareMinds",
        section: "C",
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.phone).toBe("555 1234");
    expect(body.profile.program).toBe("BSc");
    expect(body.profile.gradeSemester).toBe("5");
    expect(body.profile.college).toBe("RareMinds");
    expect(body.profile.section).toBe("C");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: "555 1234",
        metadata: expect.objectContaining({
          program: "BSc",
          gradeSemester: "5",
          college: "RareMinds",
          section: "C",
        }),
      }),
    );
  });

  it("persists the 2FA and login alert toggles", async () => {
    const chain = usersChain({ first_name: "Old", last_name: "Name", metadata: {} });
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPut(
      context("PUT", { twoFactorEnabled: true, loginAlertsEnabled: false }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.twoFactorEnabled).toBe(true);
    expect(body.profile.loginAlertsEnabled).toBe(false);
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ twoFactorEnabled: true, loginAlertsEnabled: false }),
      }),
    );
  });

  it("returns 500 when the update fails", async () => {
    const chain = usersChain(
      { first_name: "Old", last_name: "Name", metadata: {} },
      null,
      new Error("db down"),
    );
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPut(context("PUT", { fullName: "Jane Doe" }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("SERVER_ERROR");
    expect(body.error.message).toBe("Internal server error");
  });

  it("does not leak internal error details on 500", async () => {
    const chain = usersChain(
      { first_name: "Old", last_name: "Name", metadata: {} },
      null,
      "db down",
    );
    vi.mocked(createServiceSupabase).mockReturnValueOnce({
      from: vi.fn().mockReturnValue(chain),
    } as unknown as SupabaseClient);

    const response = await onRequestPut(context("PUT", { fullName: "Jane Doe" }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toBe("Internal server error");
    expect(body.error.message).not.toContain("db down");
  });
});
