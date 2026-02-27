import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  language: z.enum(['tr', 'en']).optional().default('tr'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const loginWithPhoneSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export const requestPhoneOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
});

export const verifyPhoneOtpSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
  code: z.string().length(6, 'OTP must be 6 digits'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters')
    .optional(),
  language: z.enum(['tr', 'en']).optional().default('tr'),
});

export const createRoomSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title must be at most 100 characters'),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  language: z.enum(['tr', 'en']).optional().default('tr'),
  visibility: z.enum(['public', 'private']).optional().default('public'),
  maxSpeakers: z.number().min(2).max(10).optional().default(6),
  micRequestsEnabled: z.boolean().optional().default(true),
  tags: z.array(z.string()).optional(),
});

export const updateRoomSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  maxSpeakers: z.number().min(2).max(10).optional(),
  micRequestsEnabled: z.boolean().optional(),
});

export const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric').optional(),
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
  interests: z.array(z.string()).optional(),
  language: z.enum(['tr', 'en']).optional(),
});

const userReportSchema = z.object({
  targetType: z.literal('user'),
  targetId: z.string(),
  category: z.enum(['harassment', 'hate_speech', 'spam', 'other']),
  description: z.string().max(1000).optional(),
});

const roomReportSchema = z.object({
  targetType: z.literal('room'),
  roomId: z.string(),
  category: z.enum(['harassment', 'hate_speech', 'spam', 'other']),
  description: z.string().max(1000).optional(),
});

export const reportSchema = z.discriminatedUnion('targetType', [
  userReportSchema,
  roomReportSchema,
]);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type LoginWithPhoneInput = z.infer<typeof loginWithPhoneSchema>;
export type RequestPhoneOtpInput = z.infer<typeof requestPhoneOtpSchema>;
export type VerifyPhoneOtpInput = z.infer<typeof verifyPhoneOtpSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ReportInput = z.infer<typeof reportSchema>;

export function getZodErrorMessage(error: unknown, fallback = 'Invalid input'): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues?: Array<{ path?: Array<string | number>; message?: string }> }).issues;
    const firstIssue = issues?.[0];
    if (firstIssue?.message) {
      const path = Array.isArray(firstIssue.path) && firstIssue.path.length > 0
        ? `${firstIssue.path.join('.')}: `
        : '';
      return `${path}${firstIssue.message}`;
    }
  }

  return fallback;
}
