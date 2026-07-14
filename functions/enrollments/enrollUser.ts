// Enrollment management functions

export interface Enrollment {
	id: string;
	userId: string;
	courseId: string;
	enrolledAt: string;
	progress: number;
}

export const enrollUser = async (
	userId: string,
	courseId: string,
): Promise<Enrollment> => {
	if (!userId || !courseId) {
		throw new Error("User ID and Course ID are required");
	}

	return {
		id: Math.random().toString(36).substr(2, 9),
		userId,
		courseId,
		enrolledAt: new Date().toISOString(),
		progress: 0,
	};
};

export const getEnrollments = async (userId: string): Promise<Enrollment[]> => {
	return [
		{
			id: "enrollment-1",
			userId,
			courseId: "course-1",
			enrolledAt: new Date().toISOString(),
			progress: 50,
		},
	];
};

export const updateEnrollmentProgress = async (
	enrollmentId: string,
	progress: number,
): Promise<Enrollment> => {
	return {
		id: enrollmentId,
		userId: "user-123",
		courseId: "course-1",
		enrolledAt: new Date().toISOString(),
		progress,
	};
};
