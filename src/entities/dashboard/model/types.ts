export interface CareerTargetData {
  title: string;
  readinessPercentage: number;
  strengthsCount: number;
  capabilityGapsCount: number;
  domain: string;
  industry: string;
  level: string;
  xp: number;
  xpThisWeek: number;
  streakDays: number;
  badgesCount: number;
}

export interface CurrentJourneyData {
  title: string;
  moduleInfo: string;
  capability: string;
  output: string;
  whyItMatters: string;
  progressPercentage: number;
  completedCount: number;
  inProgressCount: number;
  remainingCount: number;
  /** backend does not send this today; present only in the mock base */
  timeRemaining?: string | null;
  levelId?: string;
  moduleNo?: number;
  capabilityCode?: string;
}

export type JourneyState = "active" | "completed" | "no_track";

export interface PriorityItem {
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  xpReward: number;
  type: "green" | "purple" | "amber";
}

export interface TodaysPrioritiesData {
  currentXp: number;
  goalXp: number;
  items: PriorityItem[];
}

export type GapLevel = "Developing" | "Working Knowledge" | "Foundation" | "Proficient";

export interface CapabilityGapItem {
  id: string;
  capability: string;
  currentLevel: GapLevel;
  targetLevel: GapLevel;
}

export interface UpcomingItem {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  type: "education" | "portfolio";
}

export interface FeedbackItem {
  id: string;
  title: string;
  subtitle: string;
  daysAgo: string;
  type: "interview" | "ai-mentor";
}

export interface UpcomingFeedbackData {
  upcoming: UpcomingItem[];
  recentFeedback: FeedbackItem[];
}

export interface CareerTrackItem {
  id: string;
  title: string;
  matchPercentage?: number;
  isExplore?: boolean;
  isSelected?: boolean;
  fit?: string;
}

export interface RecommendedCareerPathsData {
  activeTrackTitle: string;
  matchPercentage: number;
  description: string;
  whyItFits: string;
  overallProgress: number;
  capabilitiesCount: number;
  competitionCount: number;
  marketStatusPercentage: number;
  tracks: CareerTrackItem[];
}

export interface AchievementItem {
  id: string;
  title: string;
  subtitle: string;
  iconType: "project" | "streak" | "api" | "architect";
}

export interface AchievementsData {
  unlockedCount: number;
  shownCount: number;
  items: AchievementItem[];
  nextMilestoneTitle: string;
  nextMilestoneDescription: string;
  nextMilestoneProgressPercentage: number;
}

export interface TodayXpEvent {
  id: string;
  event_type: string;
  xp_amount: number;
  metadata: Record<string, unknown>;
}

export interface DashboardData {
  careerTarget: CareerTargetData;
  journey: CurrentJourneyData | null;
  journeyState: JourneyState;
  priorities: TodaysPrioritiesData;
  capabilityGaps: CapabilityGapItem[];
  upcomingFeedback: UpcomingFeedbackData;
  careerPaths: RecommendedCareerPathsData;
  achievements: AchievementsData;
  todayEvents?: TodayXpEvent[];
}
