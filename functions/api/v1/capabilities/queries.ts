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

export async function getLevelCountsForCapabilities(
  supabase: SupabaseClient,
  capabilityIds: string[],
): Promise<Record<string, number>> {
  if (capabilityIds.length === 0) return {};

  const { data, error } = await supabase
    .from("levels")
    .select("capability_id, id")
    .in("capability_id", capabilityIds);

  if (error) {
    throw new Error(`Failed to fetch level counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.capability_id] = (counts[row.capability_id] ?? 0) + 1;
  }
  return counts;
}

export async function getUserCapabilities(
  supabase: SupabaseClient,
  roleId: string,
): Promise<UserCapability[]> {
  const capabilities = await getCapabilitiesByRoleId(supabase, roleId);
  if (capabilities.length === 0) return [];

  const capIds = capabilities.map((c) => c.id);
  const levelCounts = await getLevelCountsForCapabilities(supabase, capIds);

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
  }));
}

interface CapabilityLevelRow {
  id: string;
  level_code: string;
  title: string;
  description: string;
  example_outputs: string[] | null;
  duration_minutes: number | null;
  difficulty_level: string;
  status: string;
  level_scale: { level_no: number } | { level_no: number }[] | null;
}

export async function getLevelsForCapability(
  supabase: SupabaseClient,
  capabilityId: string,
): Promise<CapabilityLevel[]> {
  const { data, error } = await supabase
    .from("levels")
    .select(
      "id, level_code, title, description, example_outputs, duration_minutes, difficulty_level, status, level_scale(level_no)",
    )
    .eq("capability_id", capabilityId)
    .eq("is_active", true)
    .eq("status", "published");

  if (error) {
    throw new Error(`Failed to fetch capability levels: ${error.message}`);
  }

  return ((data as CapabilityLevelRow[] | null) ?? [])
    .map((row) => {
      const scale = Array.isArray(row.level_scale) ? row.level_scale[0] : row.level_scale;
      return {
        id: row.id,
        levelNumber: scale?.level_no ?? 0,
        code: row.level_code,
        title: row.title,
        description: row.description,
        deliverables: row.example_outputs ?? [],
        durationMinutes: row.duration_minutes ?? 0,
        difficulty: row.difficulty_level,
        status: row.status,
      };
    })
    .sort((a, b) => a.levelNumber - b.levelNumber);
}
