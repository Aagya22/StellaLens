import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel, publicUser } from '../models/User';
import { registerSchema, loginSchema } from '../schemas/auth';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { rateLimit } from '../middleware/rateLimit';
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
} from '../middleware/auth';
import { isDatabaseReady } from '../config/db';
import { ZodSchema } from 'zod';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

function validate<T>(schema: ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path.join('.') || 'body';
    if (!fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  throw new HttpError(400, 'Please check the details entered', fieldErrors);
}

function assertDatabase(): void {
  if (!isDatabaseReady()) {
    throw new HttpError(503, 'Service temporarily unavailable — please try again shortly');
  }
}

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20 });

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password } = validate(registerSchema, req.body);
    assertDatabase();

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let user;
    try {
      user = await UserModel.create({ name, email, passwordHash });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new HttpError(409, 'An account with that email already exists', {
          email: 'An account with that email already exists',
        });
      }
      throw err;
    }

    setAuthCookie(res, signToken(user.id));
    res.status(201).json({ user: publicUser(user) });
  })
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = validate(loginSchema, req.body);
    assertDatabase();

    const user = await UserModel.findOne({ email }).select('+passwordHash');
    const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) {
      throw new HttpError(401, 'Email or password is incorrect');
    }

    setAuthCookie(res, signToken(user.id));
    res.json({ user: publicUser(user) });
  })
);

authRouter.post('/logout', (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ message: 'Signed out' });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: publicUser(req.user!) });
  })
);
