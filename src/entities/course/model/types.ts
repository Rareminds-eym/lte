export type CourseStatus = "not_started" | "in_progress" | "completed";
export type CourseRole = "backend" | "frontend";

export interface Course {
  id: string;
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
  role: CourseRole;
  qualified?: boolean;
}
