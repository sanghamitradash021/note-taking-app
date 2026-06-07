import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createNoteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().nullable().optional(),
});

export const updateNoteSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    content: z.string().nullable().optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'At least one field must be provided',
  });

export const createTagSchema = z.object({
  name: z.string().min(1).max(50),
});
