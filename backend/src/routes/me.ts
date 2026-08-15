import { Router, Request, Response } from 'express';
import { publicUser } from '../models/User';
import { earCalibrationSchema } from '../schemas/auth';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get('/calibration', (req: Request, res: Response) => {
  res.json({ earCalibration: req.user!.earCalibration ?? null });
});

meRouter.put(
  '/calibration',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = earCalibrationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid calibration data');
    }

    const user = req.user!;
    user.earCalibration = { ...parsed.data, calibratedAt: new Date() };
    await user.save();

    res.json({ user: publicUser(user) });
  })
);

meRouter.delete(
  '/calibration',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    user.earCalibration = null;
    await user.save();
    res.json({ user: publicUser(user) });
  })
);
