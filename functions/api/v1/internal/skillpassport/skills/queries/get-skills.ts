import type { SupabaseClient } from "@supabase/supabase-js";
import { uniqueBy } from "../../utils/unique";

/** A skill enriched with the level + capability context it was earned from. */
export interface SkillWithContext {
  id: string;
  code?: string;
  name: string;
  description?: string;
  tags?: string[];
  levelId: string;
  levelCode: string;
  levelTitle: string;
  capabilityId: string;
  capabilityCode?: string;
  capabilityName: string;
  levelStatus: string;
  completedAt?: string;
}

function parseTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : String(v)));
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v: unknown) => String(v)) : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Read the granular `skills` the learner "owns" — the skills linked (via
 * `level_skills`) to levels the learner has COMPLETED within their active track's
 * capabilities. A skill shared across several completed levels is returned once
 * (dedup by skill_id, keeping the first completed occurrence). READ-ONLY.
 */
export async function getSkillsForUser(
  supabase: SupabaseClient,
  userId: string,
  capabilityIds: string[],
): Promise<SkillWithContext[]> {
  if (capabilityIds.length === 0) return [];

  const { data: levels, error: levelsError } = await supabase
    .from("levels")
    .select("id, level_code, title, capability_id")
    .in("capability_id", capabilityIds)
    .eq("is_active", true)
    .eq("status", "published");
  if (levelsError) {
    throw new Error(`Failed to fetch levels: ${levelsError.message}`);
  }
  const levelsList = (levels ?? []) as Array<{
    id: string;
    level_code: string;
    title: string;
    capability_id: string;
  }>;
  if (levelsList.length === 0) return [];

  const levelIds = levelsList.map((l) => l.id);

  const { data: levelProgress, error: progressError } = await supabase
    .from("user_capability_level_progress")
    .select("level_id, status, completed_at")
    .eq("user_id", userId)
    .in("level_id", levelIds)
    .eq("status", "completed");
  if (progressError) {
    throw new Error(`Failed to fetch level progress: ${progressError.message}`);
  }
  const completedProgress = (levelProgress ?? []).filter((p) => p.status === "completed");
  if (completedProgress.length === 0) return [];

  const completedLevelIds = completedProgress.map((p) => p.level_id);
  const completedAtByLevel = new Map(
    completedProgress.map((p) => [p.level_id, p.completed_at ?? undefined] as const),
  );

  const { data: levelSkills, error: lsError } = await supabase
    .from("level_skills")
    .select("level_id, skill_id")
    .in("level_id", completedLevelIds);
  if (lsError) {
    throw new Error(`Failed to fetch level skills: ${lsError.message}`);
  }
  const levelSkillsList = (levelSkills ?? []) as Array<{ level_id: string; skill_id: string }>;
  if (levelSkillsList.length === 0) return [];

  const skillIds = Array.from(new Set(levelSkillsList.map((ls) => ls.skill_id)));
  const { data: skills, error: skillsError } = await supabase
    .from("skills")
    .select("id, code, name, description, tags")
    .in("id", skillIds);
  if (skillsError) {
    throw new Error(`Failed to fetch skills: ${skillsError.message}`);
  }
  const skillsList = (skills ?? []) as Array<{
    id: string;
    code?: string | null;
    name: string;
    description?: string | null;
    tags?: unknown;
  }>;
  if (skillsList.length === 0) return [];

  const capabilityIdsSet = Array.from(new Set(levelsList.map((l) => l.capability_id)));
  const { data: capabilities, error: capError } = await supabase
    .from("capabilities")
    .select("id, code, name")
    .in("id", capabilityIdsSet);
  if (capError) {
    throw new Error(`Failed to fetch capabilities: ${capError.message}`);
  }

  const skillById = new Map(skillsList.map((s) => [s.id, s]));
  const levelById = new Map(levelsList.map((l) => [l.id, l]));
  const capById = new Map(
    ((capabilities ?? []) as Array<{ id: string; code?: string | null; name: string }>).map((c) => [
      c.id,
      c,
    ]),
  );

  // A skill earned across several completed levels must resolve to a STABLE
  // representative level — otherwise the level context (levelCode/levelTitle,
  // which are part of the fingerprint) could flip between syncs depending on
  // the DB row order and defeat the SP delta sync. Rank by when the level was
  // completed (earliest first — that is when the skill was first earned), with
  // level_id as a deterministic tie-break.
  const orderedLevelSkills = [...levelSkillsList].sort((a, b) => {
    const aCompletedAt = completedAtByLevel.get(a.level_id) ?? "";
    const bCompletedAt = completedAtByLevel.get(b.level_id) ?? "";
    if (aCompletedAt !== bCompletedAt) {
      return aCompletedAt < bCompletedAt ? -1 : 1;
    }
    return a.level_id.localeCompare(b.level_id);
  });

  // Dedup by skill_id — first occurrence wins, order preserved.
  const uniqueLevelSkills = uniqueBy(orderedLevelSkills, (ls) => ls.skill_id);
  const result: SkillWithContext[] = [];
  for (const ls of uniqueLevelSkills) {
    const skill = skillById.get(ls.skill_id);
    const level = levelById.get(ls.level_id);
    if (!skill || !level) continue;
    const cap = capById.get(level.capability_id);
    result.push({
      id: skill.id,
      code: skill.code ?? undefined,
      name: skill.name,
      description: skill.description ?? undefined,
      tags: parseTags(skill.tags),
      levelId: level.id,
      levelCode: level.level_code,
      levelTitle: level.title,
      capabilityId: level.capability_id,
      capabilityCode: cap?.code ?? undefined,
      capabilityName: cap?.name ?? "",
      levelStatus: "completed",
      completedAt: completedAtByLevel.get(level.id),
    });
  }
  return result;
}
