import { z } from 'zod';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(200)
  .email('Enter a valid email address');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password is too long');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(200),
});

const lobePoint = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});

export const earCalibrationSchema = z.object({
  screenLeft: lobePoint,
  screenRight: lobePoint,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type EarCalibrationInput = z.infer<typeof earCalibrationSchema>;
