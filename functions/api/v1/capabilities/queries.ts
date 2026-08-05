import { apiLogger } from "@functions/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Capability,
  CapabilityLevel,
  RoleCapabilitySequenceRow,
  UserCapability,
} from "./types";

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

export async function getLevelStatsForCapabilities(
  supabase: SupabaseClient,
  capabilityIds: string[],
): Promise<{ counts: Record<string, number>; xpSums: Record<string, number> }> {
  if (capabilityIds.length === 0) return { counts: {}, xpSums: {} };

  const { data, error } = await supabase
    .from("levels")
    .select("capability_id, id, total_xp")
    .in("capability_id", capabilityIds);

  if (error) {
    throw new Error(`Failed to fetch level counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  const xpSums: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{
    capability_id: string;
    id: string;
    total_xp?: number;
  }>) {
    counts[row.capability_id] = (counts[row.capability_id] ?? 0) + 1;
    xpSums[row.capability_id] = (xpSums[row.capability_id] ?? 0) + (row.total_xp ?? 0);
  }
  return { counts, xpSums };
}

export async function getLevelCountsForCapabilities(
  supabase: SupabaseClient,
  capabilityIds: string[],
): Promise<Record<string, number>> {
  const { counts } = await getLevelStatsForCapabilities(supabase, capabilityIds);
  return counts;
}

export async function getUserCapabilities(
  supabase: SupabaseClient,
  roleId: string,
): Promise<UserCapability[]> {
  const capabilities = await getCapabilitiesByRoleId(supabase, roleId);
  if (capabilities.length === 0) return [];

  const capIds = capabilities.map((c) => c.id);
  const { counts: levelCounts, xpSums } = await getLevelStatsForCapabilities(supabase, capIds);

  return capabilities.map((cap) => ({
    id: cap.id,
    name: cap.name,
    description: cap.description,
    code: cap.code,
    level: cap.level,
    priority: cap.priority ?? "",
    step: cap.step,
    totalLevels: levelCounts[cap.id] ?? 0,
    currentLevel: 0,
    status: "not_started",
    progress: 0,
    xp: xpSums[cap.id] ?? 0,
  }));
}

export async function getLevelsForCapability(
  supabase: SupabaseClient,
  capabilityId: string,
): Promise<CapabilityLevel[]> {
  const { data, error } = await supabase
    .from("levels")
    .select(
      "id, level_code, title, description, example_outputs, duration_minutes, difficulty_level, status, total_xp",
    )
    .eq("capability_id", capabilityId)
    .eq("is_active", true)
    .eq("status", "published");

  if (error) {
    throw new Error(`Failed to fetch capability levels: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => {
      let deliverables: string[] = [];
      if (Array.isArray(row.example_outputs)) {
        deliverables = row.example_outputs;
      } else if (typeof row.example_outputs === "string") {
        try {
          deliverables = JSON.parse(row.example_outputs);
        } catch {
          deliverables = [row.example_outputs];
        }
      }

      const levelCodeMatch = row.level_code.match(/L(\d+)/i);
      if (!levelCodeMatch) {
        apiLogger.warn(`Unrecognized level_code format: ${row.level_code}`, { capabilityId });
      }
      const parsedLevelNo = parseInt(levelCodeMatch?.[1] ?? "1", 10);

      return {
        id: row.id,
        levelNumber: parsedLevelNo,
        code: row.level_code,
        title: row.title,
        description: row.description,
        deliverables,
        durationMinutes: row.duration_minutes ?? 0,
        difficulty: row.difficulty_level ?? "intermediate",
        status: row.status,
        totalXp: (row as { total_xp?: number }).total_xp ?? 0,
      };
    })
    .sort((a, b) => a.levelNumber - b.levelNumber);
}
