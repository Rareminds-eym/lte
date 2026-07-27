import type React from "react";
import { useParams } from "react-router-dom";

export const CourseDetail: React.FC = () => {
  const { capabilityCode } = useParams<{ capabilityCode: string }>();

  return (
    <div className="p-8" data-testid="course-detail-page">
      <h1 className="text-2xl font-bold text-content-primary">Course Details</h1>
      <p className="text-content-secondary mt-2">
        Capability Code:{" "}
        <span className="font-mono bg-surface-muted px-1.5 py-0.5 rounded text-brand-600">
          {capabilityCode}
        </span>
      </p>
    </div>
  );
};
