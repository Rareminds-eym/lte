import type { SupabaseClient } from "@supabase/supabase-js";
import type { Capability, RoleCapabilitySequenceRow } from "./types";

export async function getCapabilitiesByRoleId(
  supabase: SupabaseClient,
  roleId: string,
): Promise<Capability[]> {
  const { data, error } = await supabase
    .from("role_capability_sequence")
    .select(`
      id,
      sequence_step,
      required_level,
      capability_priority,
      capabilities (
        id,
        code,
        name,
        description
      )
    `)
    .eq("role_id", roleId)
    .order("sequence_step", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch role capabilities: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((item: RoleCapabilitySequenceRow) => {
    const cap = Array.isArray(item.capabilities) ? item.capabilities[0] : item.capabilities;

    return {
      id: cap?.id ?? "",
      name: cap?.name ?? "",
      description: cap?.description ?? "",
      code: cap?.code ?? undefined,
      level: item.required_level ?? undefined,
      priority: item.capability_priority ?? undefined,
      step: item.sequence_step ?? undefined,
    };
  });
}
