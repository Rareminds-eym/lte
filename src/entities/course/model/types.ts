export type CourseStatus = "not_started" | "in_progress" | "completed";

export interface Course {
  id: string;
  capabilityId: string;
  capabilityCode: string;
  title: string;
  description: string;
  category: string;
  level: string;
  imageUrl: string;
  tags: string[];
  status: CourseStatus;
  progress: number;
  currentLevel: number;
  totalLevels: number;
  targetLevel: string;
  durationHours: number;
  xp: number;
  badge?: string;
  priority: string;
  qualified?: boolean;
  roleId?: string;
  roleName?: string;
  slug: string;
}
