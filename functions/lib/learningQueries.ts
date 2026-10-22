import type { QueryGatewayReadPolicy, QueryGatewayRpcPolicy } from "@functions/lib/query-gateway";
export const learningSnapshotPolicy = {
  operation: "rpc",
  functionName: "job_learning_snapshot",
  allowedArgs: ["p_user", "p_levels", "p_policy"],
} as const satisfies QueryGatewayRpcPolicy;
export const learningCriteriaPolicy = {
  operation: "read",
  table: "levels",
  columns: ["title", "description", "observable_behavior"],
  filters: ["id"],
  maxPageSize: 1,
} as const satisfies QueryGatewayReadPolicy;
export const learningClaimPolicy = {
  operation: "rpc",
  functionName: "claim_learning_progress_delivery",
  allowedArgs: [],
} as const satisfies QueryGatewayRpcPolicy;
export const learningFinishPolicy = {
  operation: "rpc",
  functionName: "finish_learning_progress_delivery",
  allowedArgs: ["p_user", "p_level", "p_token", "p_success"],
} as const satisfies QueryGatewayRpcPolicy;
