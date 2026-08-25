import { z } from "zod";

// Backend request/response validation schemas

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["user", "instructor", "admin"]).default("user"),
});

export type CreateUserRequest = z.infer<typeof CreateUserSchema>;

export const CreateCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  instructor: z.string(),
});

export type CreateCourseRequest = z.infer<typeof CreateCourseSchema>;

export const EnrollmentSchema = z.object({
  userId: z.string().uuid(),
  courseId: z.string().uuid(),
});

export type EnrollmentRequest = z.infer<typeof EnrollmentSchema>;

export * from "./artifacts";
