import { z } from "zod";

export const AccountActionSchema = z.object({
  action: z.enum(["deactivate"]),
});

export const PasswordChangeSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(8, "New password must be at least 8 characters"),
});

export const ProfileUpdateSchema = z
  .object({
    fullName: z.string().trim().max(200).optional(),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    phone: z.string().trim().max(30).optional(),
    program: z.string().trim().max(100).optional(),
    gradeSemester: z.string().trim().max(50).optional(),
    college: z.string().trim().max(200).optional(),
    section: z.string().trim().max(50).optional(),
    twoFactorEnabled: z.boolean().optional(),
    loginAlertsEnabled: z.boolean().optional(),
  })
  .strict();
