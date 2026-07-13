// Course management functions

export interface Course {
	id: string;
	title: string;
	description: string;
	instructor: string;
	studentCount: number;
}

export const getCourses = async (
	page: number = 1,
	limit: number = 10,
): Promise<Course[]> => {
	// Mock implementation - replace with actual database query
	return [
		{
			id: "course-1",
			title: "Introduction to React",
			description: "Learn the basics of React",
			instructor: "Jane Smith",
			studentCount: 45,
		},
		{
			id: "course-2",
			title: "Advanced TypeScript",
			description: "Deep dive into TypeScript",
			instructor: "John Doe",
			studentCount: 32,
		},
	];
};

export const getCourse = async (courseId: string): Promise<Course> => {
	const courses = await getCourses();
	const course = courses.find((c) => c.id === courseId);
	if (!course) {
		throw new Error("Course not found");
	}
	return course;
};

export const createCourse = async (
	courseData: Omit<Course, "id" | "studentCount">,
): Promise<Course> => {
	const id = Math.random().toString(36).substr(2, 9);
	return { ...courseData, id, studentCount: 0 };
};
