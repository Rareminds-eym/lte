import type React from "react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLevelDetails, useStartLevelProgress, useCourses } from "@/entities/course";
import { useAuthStore } from "@/entities/session";
import { PageLoader } from "@/shared/ui";
import {
  LevelHeroBanner,
  LevelModuleList,
  LevelProblemStatement,
  LevelStatsBar,
} from "@/widgets/level-modules";

export const LevelModulesPage: React.FC = () => {
  const navigate = useNavigate();
  const { capabilityCode, levelId } = useParams<{
    capabilityCode?: string;
    levelId?: string;
  }>();

  const userId = useAuthStore((s) => s.user?.id);
  const { data: courses } = useCourses(userId);
  const { data: levelData, isLoading, error } = useLevelDetails(levelId, capabilityCode);
  const { mutate: startLevel } = useStartLevelProgress();

  useEffect(() => {
    if (levelId) {
      startLevel(levelId);
    }
  }, [levelId, startLevel]);

  const handleContinueLearning = () => {
    if (levelId) {
      navigate(`/my-courses/${encodeURIComponent(levelId)}/modules/1`);
    }
  };

  if (isLoading) {
    return <PageLoader message="Loading level modules..." />;
  }

  const handleBackToCourses = () => {
    navigate("/my-courses");
  };

  if (error || !levelData) {
    return (
      <div className="flex h-full min-h-[60vh] w-full items-center justify-center p-4">
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-xs border border-slate-200 text-center max-w-md w-full">
          <h3 className="text-base md:text-lg font-bold text-slate-900 mb-2">
            Course Content Not Available
          </h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            This course content is not available right now. Please go back to your courses and try
            again.
          </p>
          <button
            type="button"
            onClick={handleBackToCourses}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  const title = levelData.title;
  const description = levelData.description;
  const problemTitle = levelData.levelProblemStatement.title;
  const problemDescription = levelData.levelProblemStatement.description;
  const modulesList = levelData.modules || [];
  const totalCount = modulesList.length;

  // Module content status: isPublished = module content is ready for learners
  const publishedModules = modulesList.filter((m) => m.isPublished);
  const unpublishedModules = modulesList.filter((m) => !m.isPublished);

  // Hero banner progress: published = done, first unpublished = active, rest = available
  const doneCount = publishedModules.length;
  const activeCount = unpublishedModules.length > 0 ? 1 : 0;
  const availableCount = Math.max(0, unpublishedModules.length - activeCount);
  const calculatedProgress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // User submissions: comes from user progress API (not yet wired — 0 until available)
  const submittedCount = 0;

  // Level badge from DB data only
  const levelBadge =
    levelData.levelNo && (levelData.levelLabel || levelData.difficultyLevel)
      ? `LEVEL ${levelData.levelNo} · ${(levelData.levelLabel || levelData.difficultyLevel).toUpperCase()}`
      : undefined;

  // Next up: first unpublished module, or first module overall
  const nextUpModule = modulesList.find((m) => !m.isPublished) ?? modulesList[0];
  const nextUpTitle = nextUpModule
    ? `Module ${nextUpModule.moduleNo} · ${nextUpModule.title}`
    : undefined;

  // Duration from DB
  const totalDuration = levelData.durationMinutes
    ? `${Math.round(levelData.durationMinutes / 60)} hrs`
    : undefined;

  // Find active course from user's course list to get totalLevels & targetLevel
  const activeCourse = courses?.find(
    (c) =>
      c.capabilityCode.toLowerCase() === (levelData.capabilityCode || capabilityCode || "").toLowerCase() ||
      c.capabilityId === (levelData.capabilityCode || capabilityCode) ||
      c.id === (levelData.capabilityCode || capabilityCode),
  );

  const dynamicTotalLevels = activeCourse?.totalLevels ?? 5;
  const dynamicTargetLevel = activeCourse?.targetLevel ?? "TARGET: L3";

  return (
    <div className="-mx-4 md:-mx-6 -mt-4 md:-mt-6 pb-12">
      {/* Level Hero Banner */}
      <LevelHeroBanner
        capabilityCode={levelData.capabilityCode || capabilityCode || ""}
        capabilityName={undefined}
        levelBadge={levelBadge}
        title={title}
        description={description}
        overallProgress={calculatedProgress}
        doneCount={doneCount}
        activeCount={activeCount}
        availableCount={availableCount}
        nextUpTitle={nextUpTitle}
        onContinueLearning={handleContinueLearning}
      />

      <div className="px-4 md:px-6">
        {/* Floating Level Meta Stats Bar inside padded container */}
        <div className="-mt-8 relative z-20">
          <LevelStatsBar
            totalDuration={totalDuration}
            modulesCount={totalCount}
            artifactsCount={levelData.artifactsCount}
            hasCertificate={true}
            currentLevelNo={levelData.levelNo}
            totalLevelsNo={dynamicTotalLevels}
            targetLevel={dynamicTargetLevel}
          />
        </div>

        {/* Problem Statement Section */}
        <div className="mt-8 md:mt-10">
          <LevelProblemStatement
            title={problemTitle}
            description={problemDescription}
            completedModules={submittedCount}
            totalModules={totalCount}
          />
        </div>

        {/* Course Modules List Section */}
        <LevelModuleList
          modules={modulesList}
          levelId={levelId}
          onSelectModule={(moduleNo) => {
            if (levelId) {
              navigate(`/my-courses/${encodeURIComponent(levelId)}/modules/${moduleNo}`);
            }
          }}
        />
      </div>
    </div>
  );
};
