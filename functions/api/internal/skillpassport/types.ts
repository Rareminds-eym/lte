import type { GatewayResult } from "@functions/lib/gateway-envelope";
import type { LteEnv } from "@functions/lib/types";

export type { GatewayResult } from "@functions/lib/gateway-envelope";

/** Context handed to every action after the service token + user claim pass. */
export interface GatewayContext {
  env: LteEnv;
  request: Request;
  requestId: string;
  /** Verified subject of the per-user signed claim — never trust a payload userId blindly. */
  userId: string;
  /** Origin of the request that reached this gateway (used for public deep-links). */
  origin: string;
}

export type GatewayAction = (
  ctx: GatewayContext,
  payload: Record<string, unknown>,
) => Promise<GatewayResult>;
