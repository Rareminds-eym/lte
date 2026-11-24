import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LteEnv } from "../../shared/types";
import {
  acknowledgeTrackActivation,
  authorizeTrackActivation,
  reserveTrackActivation,
  validateTrackReservation,
} from "../subscription-access";

const gateway = vi.hoisted(() => vi.fn());
vi.mock("../skill-gateway", () => ({ callSkill: gateway }));

const actor = "a0000000-0000-4000-8000-000000000001";
const subscription = "b0000000-0000-4000-8000-000000000001";
const product = "c0000000-0000-4000-8000-000000000001";
const revision = "d0000000-0000-4000-8000-000000000001";
const proof = () => ({
  schemaVersion: 1,
  actorId: actor,
  subject: { kind: "user", id: actor },
  subscriptionId: subscription,
  productId: product,
  revisionId: revision,
  version: 1,
  actionKey: "learning_path.activate",
  featureKey: "learning_tracks",
  mode: "write",
  validUntil: 2000,
  quota: {
    period: "billing_period",
    countingEvent: "course_lte_assignment",
    periodStartsAt: 100,
    periodEndsAt: 2000,
    limit: 2,
  },
});
const owner = () => ({
  schemaVersion: 1,
  actorId: actor,
  access: "full",
  activatedAt: 50,
  state: {
    id: subscription,
    subject: { kind: "user", id: actor },
    productId: product,
    revisionId: revision,
    version: 1,
    periodStartsAt: 100,
    periodEndsAt: 2000,
  },
  subscriptionEndsAt: 3000,
  actions: {
    schemaVersion: 1,
    bindings: [
      {
        actionKey: "learning_path.activate",
        featureKey: "learning_tracks",
        mode: "write",
        quota: { period: "billing_period", countingEvent: "course_lte_assignment" },
      },
    ],
  },
});
const fetcher = vi.fn(),
  getContext = vi.fn();
const env = {
  SKILLPASSPORT_INTERNAL_URL: "https://application.invalid",
  SSO_SERVICE: { getSubscriptionActionContext: getContext },
} as unknown as LteEnv;
const request = () =>
  new Request("https://lte.invalid/api/v1/learning-paths/active-track", {
    headers: {
      authorization: "Bearer isolated-token",
      traceparent: "00-" + "1".repeat(32) + "-" + "2".repeat(16) + "-01",
    },
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(1000);
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(Response.json(proof()));
  getContext.mockResolvedValue(owner());
});

const operation = "e0000000-0000-4000-8000-000000000001",
  track = "f0000000-0000-4000-8000-000000000001";
const reservation = () =>
  validateTrackReservation({
    schemaVersion: 1,
    operationId: operation,
    actorId: actor,
    trackId: track,
    authorization: proof(),
    status: "pending",
    outcome: null,
    quotaReceipt: {
      used: 1,
      command: {
        operationId: operation,
        actorId: actor,
        subject: { kind: "user", id: actor },
        subscriptionId: subscription,
        productId: product,
        revisionId: revision,
        version: 1,
        actionKey: "learning_path.activate",
        countingEvent: "course_lte_assignment",
        resourceId: operation,
        periodStartsAt: 100,
        periodEndsAt: 2000,
        limit: 2,
      },
    },
  });
const outcome = (created = true) => ({
  schemaVersion: 1,
  operationId: operation,
  reservationId: operation,
  actorId: actor,
  trackId: track,
  subscriptionId: subscription,
  productId: product,
  revisionId: revision,
  version: 1,
  created,
  completedAt: 1500,
});
it("obtains the shared application counter using the original bearer, exact operation and target", async () => {
  fetcher
    .mockResolvedValueOnce(Response.json(proof()))
    .mockResolvedValueOnce(Response.json(reservation()));
  expect(await reserveTrackActivation(env, request(), actor, operation, track)).toEqual(
    reservation(),
  );
  const [url, options] = fetcher.mock.calls[1]!;
  expect(String(url)).toBe("https://application.invalid/api/subscriptions/quota-reservations");
  expect(options.headers.Authorization).toBe("Bearer isolated-token");
  expect(JSON.parse(options.body)).toEqual({ operationId: operation, trackId: track });
  expect(options.signal).toBeInstanceOf(AbortSignal);
});
it.each([
  "target",
  "operation",
  "revision",
  "version",
  "limit",
  "period",
  "feature",
  "deadline",
])("rejects inconsistent central %s before local activation", async (defect) => {
  const value = reservation();
  if (defect === "target") value.trackId = subscription;
  if (defect === "operation") {
    value.operationId = track;
    value.quotaReceipt.command.operationId = track;
    value.quotaReceipt.command.resourceId = track;
  }
  if (defect === "revision") {
    value.authorization.revisionId = product;
    value.quotaReceipt.command.revisionId = product;
  }
  if (defect === "version") {
    value.authorization.version = 2;
    value.quotaReceipt.command.version = 2;
  }
  if (defect === "period") {
    value.authorization.quota!.periodStartsAt = 99;
    value.quotaReceipt.command.periodStartsAt = 99;
  }
  if (defect === "feature") value.authorization.featureKey = "other_feature";
  if (defect === "deadline") value.authorization.validUntil = 2001;
  if (defect === "limit") {
    value.authorization.quota!.limit = 3;
    value.quotaReceipt.command.limit = 3;
  }
  fetcher.mockResolvedValueOnce(Response.json(proof())).mockResolvedValueOnce(Response.json(value));
  await expect(reserveTrackActivation(env, request(), actor, operation, track)).rejects.toThrow();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([
  true,
  false,
])("acknowledges durable created=%s after deadline without changing its original outcome", async (created) => {
  vi.mocked(Date.now).mockReturnValue(9000);
  const held = reservation(),
    committed = outcome(created);
  gateway.mockResolvedValue({ ...held, status: "confirmed", outcome: committed });
  expect((await acknowledgeTrackActivation(env, held, committed)).outcome).toEqual(committed);
  expect(gateway).toHaveBeenCalledExactlyOnceWith(
    env,
    "subscription-resource:acknowledge",
    { outcome: committed },
    actor,
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not turn an uncertain acknowledgement into released capacity or fabricated success", async () => {
  gateway.mockRejectedValue(new Error("uncertain delivery"));
  await expect(acknowledgeTrackActivation(env, reservation(), outcome())).rejects.toThrow(
    "uncertain delivery",
  );
  expect(gateway).toHaveBeenCalledTimes(1);
  expect(fetcher).not.toHaveBeenCalled();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("signed track activation authority", () => {
  it("binds immutable application grants to the original bearer and current SSO state", async () => {
    expect(await authorizeTrackActivation(env, request(), actor)).toEqual(proof());
    expect(getContext).toHaveBeenCalledExactlyOnceWith("isolated-token", subscription, product);
    const call = fetcher.mock.calls[0];
    expect(call).toBeDefined();
    const [url, options] = call!;
    expect(String(url)).toBe("https://application.invalid/api/subscriptions/action-context");
    expect(options).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: { Authorization: "Bearer isolated-token" },
    });
    expect(JSON.parse(options.body)).toEqual({
      actionKey: "learning_path.activate",
      mode: "write",
      subject: { kind: "user", id: actor },
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("rejects missing bearer before any network call", async () => {
    await expect(
      authorizeTrackActivation(env, new Request("https://lte.invalid"), actor),
    ).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
  });
  it.each([
    401, 403, 500,
  ])("preserves denial or outage status %s without alternate authorization", async (status) => {
    fetcher.mockResolvedValue(new Response(null, { status }));
    await expect(authorizeTrackActivation(env, request(), actor)).rejects.toMatchObject({
      status: status === 500 ? 503 : status,
    });
    expect(getContext).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    "actor",
    "revision",
    "version",
    "access",
    "window",
    "event",
    "payment",
    "duplicate",
  ])("rejects conflicting owner %s", async (defect) => {
    const value = owner();
    const binding = value.actions.bindings[0]!;
    if (defect === "actor") value.actorId = product;
    if (defect === "revision") value.state.revisionId = product;
    if (defect === "version") value.state.version++;
    if (defect === "access") value.access = "read_only";
    if (defect === "window") value.state.periodStartsAt++;
    if (defect === "event") binding.quota.countingEvent = "other";
    if (defect === "payment") Object.assign(binding, { paymentRequired: true });
    if (defect === "duplicate") value.actions.bindings.push(binding);
    getContext.mockResolvedValue(value);
    await expect(authorizeTrackActivation(env, request(), actor)).rejects.toMatchObject({
      status: 403,
    });
  });
  it.each([
    "expired",
    "foreign",
    "zero",
    "future",
    "extra",
  ])("rejects invalid application proof %s", async (defect) => {
    const value = proof();
    if (defect === "expired") value.validUntil = 1000;
    if (defect === "foreign") value.subject.id = product;
    if (defect === "zero") value.quota.limit = 0;
    if (defect === "future") value.quota.periodStartsAt = 1100;
    if (defect === "extra") Object.assign(value, { unlimited: true });
    fetcher.mockResolvedValue(Response.json(value));
    await expect(authorizeTrackActivation(env, request(), actor)).rejects.toThrow();
    expect(getContext).not.toHaveBeenCalled();
  });
  it("propagates an uncertain owner outage without retry", async () => {
    getContext.mockRejectedValue(new Error("unavailable"));
    await expect(authorizeTrackActivation(env, request(), actor)).rejects.toThrow("unavailable");
    expect(getContext).toHaveBeenCalledTimes(1);
  });
});

it("executes exact replay with the earlier retained deadline, never the refreshed deadline", async () => {
  const held = reservation();
  held.authorization.validUntil = 1900;
  fetcher.mockResolvedValueOnce(Response.json(proof())).mockResolvedValueOnce(Response.json(held));
  expect(
    (await reserveTrackActivation(env, request(), actor, operation, track)).authorization
      .validUntil,
  ).toBe(1900);
});
