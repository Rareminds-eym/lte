import { z } from "zod";
import { extractBearerToken } from "../middleware/auth";
import type { LteEnv } from "../shared/types";
import { callSkill } from "./skill-gateway";

const reference = z.uuid();
const time = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const trackActivationAuthorizationSchema = z
  .object({
    schemaVersion: z.literal(1),
    actorId: reference,
    subject: z.object({ kind: z.literal("user"), id: reference }).strict(),
    subscriptionId: reference,
    productId: reference,
    revisionId: reference,
    version: time.min(1),
    actionKey: z.literal("learning_path.activate"),
    featureKey: z.string().min(1),
    mode: z.literal("write"),
    validUntil: time,
    quota: z
      .object({
        period: z.enum(["subscription", "billing_period", "concurrent"]),
        countingEvent: z.literal("course_lte_assignment"),
        periodStartsAt: time,
        periodEndsAt: time,
        limit: time.nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type TrackActivationAuthorization = z.infer<typeof trackActivationAuthorizationSchema>;
export class SubscriptionAccessError extends Error {
  constructor(public readonly status: 401 | 403 | 402 | 409 | 503) {
    super("Subscription access unavailable");
  }
}

/** Uses the caller's existing SSO bearer. The internal HMAC user assertion is never substituted. */
export async function authorizeTrackActivation(
  env: LteEnv,
  request: Request,
  actorId: string,
): Promise<TrackActivationAuthorization> {
  const token = extractBearerToken(request);
  if (!token) throw new SubscriptionAccessError(401);
  const base = z.url().parse(env.SKILLPASSPORT_INTERNAL_URL);
  const configured = new URL(base);
  if (
    !["https:", "http:"].includes(configured.protocol) ||
    configured.username ||
    configured.password ||
    configured.search ||
    configured.hash
  ) {
    throw new SubscriptionAccessError(503);
  }
  const response = await fetch(new URL("/api/subscriptions/action-context", configured), {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(request.headers.has("traceparent")
        ? { traceparent: request.headers.get("traceparent")! }
        : {}),
    },
    body: JSON.stringify({
      actionKey: "learning_path.activate",
      mode: "write",
      subject: { kind: "user", id: actorId },
    }),
  });
  if (!response.ok)
    throw new SubscriptionAccessError(
      response.status === 401 ? 401 : response.status === 403 ? 403 : 503,
    );
  const authority = trackActivationAuthorizationSchema.parse(await response.json());
  if (
    authority.actorId !== actorId ||
    authority.subject.id !== actorId ||
    Date.now() >= authority.validUntil ||
    (authority.quota &&
      (authority.quota.periodStartsAt >= authority.quota.periodEndsAt ||
        authority.validUntil > authority.quota.periodEndsAt ||
        Date.now() < authority.quota.periodStartsAt ||
        authority.quota.limit === 0))
  )
    throw new SubscriptionAccessError(403);
  // Direct owner RPC independently binds the original bearer, state and action.
  // Immutable feature/grant evaluation remains owned by SkillPassport above.
  const owner = z
    .object({
      schemaVersion: z.literal(1),
      actorId: reference,
      access: z.literal("full"),
      activatedAt: time,
      state: z.object({
        id: reference,
        subject: z.object({ kind: z.literal("user"), id: reference }),
        productId: reference,
        revisionId: reference,
        version: time.min(1),
        periodStartsAt: time,
        periodEndsAt: time,
      }),
      subscriptionEndsAt: time,
      actions: z.object({
        schemaVersion: z.literal(1),
        bindings: z.array(
          z
            .object({
              actionKey: z.string(),
              featureKey: z.string(),
              mode: z.string(),
              paymentRequired: z.boolean().optional(),
              quota: z
                .object({
                  period: z.enum(["subscription", "billing_period", "concurrent"]),
                  countingEvent: z.string(),
                })
                .strict()
                .optional(),
            })
            .passthrough(),
        ),
      }),
    })
    .passthrough()
    .safeParse(
      await env.SSO_SERVICE.getSubscriptionActionContext(
        token,
        authority.subscriptionId,
        authority.productId,
      ),
    );
  if (!owner.success) throw new SubscriptionAccessError(403);
  const value = owner.data;
  const matches = value.actions.bindings.filter(
    (binding) =>
      binding.actionKey === authority.actionKey &&
      binding.featureKey === authority.featureKey &&
      binding.mode === authority.mode,
  );
  const binding = matches[0];
  if (
    value.actorId !== actorId ||
    value.state.id !== authority.subscriptionId ||
    value.state.subject.id !== actorId ||
    value.state.productId !== authority.productId ||
    value.state.revisionId !== authority.revisionId ||
    value.state.version !== authority.version ||
    Math.min(value.state.periodEndsAt, value.subscriptionEndsAt) !== authority.validUntil ||
    matches.length !== 1 ||
    !binding ||
    binding.paymentRequired === true
  ) {
    throw new SubscriptionAccessError(403);
  }
  const quota = binding.quota;
  if (
    quota
      ? !authority.quota ||
        quota.period !== authority.quota.period ||
        quota.countingEvent !== authority.quota.countingEvent ||
        authority.quota.periodStartsAt !==
          (quota.period === "subscription" ? value.activatedAt : value.state.periodStartsAt) ||
        authority.quota.periodEndsAt !==
          (quota.period === "subscription" ? value.subscriptionEndsAt : value.state.periodEndsAt)
      : authority.quota !== null
  )
    throw new SubscriptionAccessError(403);
  return authority;
}

const resourceOutcomeSchema = z
  .object({
    schemaVersion: z.literal(1),
    operationId: reference,
    reservationId: reference,
    actorId: reference,
    trackId: reference,
    subscriptionId: reference,
    productId: reference,
    revisionId: reference,
    version: time.min(1),
    created: z.boolean(),
    completedAt: time.min(1),
  })
  .strict();
export type TrackActivationOutcome = z.infer<typeof resourceOutcomeSchema>;
const quotaCommandSchema = z
  .object({
    operationId: reference,
    actorId: reference,
    subject: z.object({ kind: z.literal("user"), id: reference }).strict(),
    subscriptionId: reference,
    productId: reference,
    revisionId: reference,
    version: time.min(1),
    actionKey: z.literal("learning_path.activate"),
    countingEvent: z.literal("course_lte_assignment"),
    resourceId: reference,
    periodStartsAt: time,
    periodEndsAt: time.min(1),
    limit: time.nullable(),
  })
  .strict();
export const trackReservationSchema = z
  .object({
    schemaVersion: z.literal(1),
    operationId: reference,
    actorId: reference,
    trackId: reference,
    authorization: trackActivationAuthorizationSchema,
    quotaReceipt: z.object({ command: quotaCommandSchema, used: time.min(1) }).strict(),
    status: z.enum(["pending", "confirmed"]),
    outcome: resourceOutcomeSchema.nullable(),
  })
  .strict();
export type TrackActivationReservation = z.infer<typeof trackReservationSchema>;
export function validateTrackOutcome(value: unknown, reservation: TrackActivationReservation) {
  const outcome = resourceOutcomeSchema.parse(value),
    auth = reservation.authorization;
  if (
    outcome.operationId !== reservation.operationId ||
    outcome.reservationId !== reservation.operationId ||
    outcome.actorId !== reservation.actorId ||
    outcome.trackId !== reservation.trackId ||
    outcome.subscriptionId !== auth.subscriptionId ||
    outcome.productId !== auth.productId ||
    outcome.revisionId !== auth.revisionId ||
    outcome.version !== auth.version ||
    !auth.quota ||
    outcome.completedAt < auth.quota.periodStartsAt ||
    outcome.completedAt >= auth.validUntil
  ) {
    throw new SubscriptionAccessError(503);
  }
  return outcome;
}
export function validateTrackReservation(value: unknown) {
  const receipt = trackReservationSchema.parse(value),
    auth = receipt.authorization,
    command = receipt.quotaReceipt.command;
  if (
    !auth.quota ||
    auth.quota.period !== "billing_period" ||
    auth.quota.countingEvent !== "course_lte_assignment" ||
    receipt.actorId !== auth.actorId ||
    auth.subject.id !== receipt.actorId ||
    command.actorId !== receipt.actorId ||
    command.subject.id !== receipt.actorId ||
    command.operationId !== receipt.operationId ||
    command.resourceId !== receipt.operationId ||
    command.subscriptionId !== auth.subscriptionId ||
    command.productId !== auth.productId ||
    command.revisionId !== auth.revisionId ||
    command.version !== auth.version ||
    command.periodStartsAt !== auth.quota.periodStartsAt ||
    command.periodEndsAt !== auth.quota.periodEndsAt ||
    command.limit !== auth.quota.limit ||
    auth.quota.periodStartsAt >= auth.quota.periodEndsAt ||
    auth.validUntil <= auth.quota.periodStartsAt ||
    auth.validUntil > auth.quota.periodEndsAt ||
    (command.limit !== null && receipt.quotaReceipt.used > command.limit) ||
    (receipt.status === "pending") !== (receipt.outcome === null)
  )
    throw new SubscriptionAccessError(503);
  if (receipt.outcome) validateTrackOutcome(receipt.outcome, receipt);
  return receipt;
}
export const unchangedTrackOutcomeSchema = z
  .object({
    kind: z.literal("unchanged"),
    operationId: reference,
    actorId: reference,
    trackId: reference,
    authorization: trackActivationAuthorizationSchema,
    completedAt: time.min(1),
  })
  .strict();
export function validateUnchangedTrackOutcome(
  value: unknown,
  actorId: string,
  trackId: string,
  operationId: string,
) {
  const result = unchangedTrackOutcomeSchema.parse(value),
    auth = result.authorization;
  if (
    result.actorId !== actorId ||
    result.trackId !== trackId ||
    result.operationId !== operationId ||
    auth.actorId !== actorId ||
    auth.subject.id !== actorId ||
    !auth.quota ||
    result.completedAt < auth.quota.periodStartsAt ||
    result.completedAt >= auth.validUntil
  )
    throw new SubscriptionAccessError(503);
  return result;
}
/** Only the original caller bearer authorizes new capacity; service credentials never replace it. */
export async function reserveTrackActivation(
  env: LteEnv,
  request: Request,
  actorId: string,
  operationId: string,
  trackId: string,
) {
  const operation = reference.parse(operationId),
    track = reference.parse(trackId);
  const authority = await authorizeTrackActivation(env, request, actorId);
  const token = extractBearerToken(request);
  if (!token) throw new SubscriptionAccessError(401);
  const response = await fetch(
    new URL("/api/subscriptions/quota-reservations", z.url().parse(env.SKILLPASSPORT_INTERNAL_URL)),
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ operationId: operation, trackId: track }),
    },
  );
  if (!response.ok)
    throw new SubscriptionAccessError(
      response.status === 401
        ? 401
        : response.status === 403
          ? 403
          : response.status === 402
            ? 402
            : response.status === 409
              ? 409
              : 503,
    );
  const receipt = validateTrackReservation(await response.json());
  if (
    receipt.operationId !== operation ||
    receipt.actorId !== actorId ||
    receipt.trackId !== track ||
    receipt.authorization.validUntil > authority.validUntil ||
    JSON.stringify({ ...receipt.authorization, validUntil: authority.validUntil }) !==
      JSON.stringify(authority)
  )
    throw new SubscriptionAccessError(503);
  return receipt;
}
/** A delayed ack validates the durable commit time, never the ack wall clock. */
export async function acknowledgeTrackActivation(
  env: LteEnv,
  reservation: TrackActivationReservation,
  value: unknown,
) {
  const outcome = validateTrackOutcome(value, reservation);
  const raw = await callSkill(
    env,
    "subscription-resource:acknowledge",
    { outcome },
    outcome.actorId,
  );
  const result = validateTrackReservation(raw);
  if (
    result.operationId !== reservation.operationId ||
    result.status !== "confirmed" ||
    JSON.stringify(result.authorization) !== JSON.stringify(reservation.authorization) ||
    JSON.stringify(result.quotaReceipt) !== JSON.stringify(reservation.quotaReceipt) ||
    JSON.stringify(result.outcome) !== JSON.stringify(outcome)
  )
    throw new SubscriptionAccessError(503);
  return result;
}
