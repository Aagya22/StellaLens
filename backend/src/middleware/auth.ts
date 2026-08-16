import { NextFunction, Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env, isProd } from '../config/env';
import { UserModel, UserDocument } from '../models/User';
import { HttpError } from './errorHandler';

export const AUTH_COOKIE = 'stellalens_token';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}

interface TokenPayload {
  sub: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax',
    secure: isProd,
    path: '/',
  });
}

async function userFromRequest(req: Request): Promise<UserDocument | null> {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token || typeof token !== 'string') return null;

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }

  return UserModel.findById(payload.sub);
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await userFromRequest(req);
    if (user) req.user = user;
  } catch {
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user ?? (await userFromRequest(req));
    if (!user) {
      clearAuthCookie(res);
      return next(new HttpError(401, 'Please sign in to continue'));
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
