import { Router, Request, Response } from 'express';
import { publicUser, publicCart } from '../models/User';
import { earCalibrationSchema } from '../schemas/auth';
import { cartSchema } from '../schemas/cart';
import { resolveCatalog } from '../data/catalog';
import { OrderModel, publicOrder } from '../models/Order';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/auth';

export const meRouter = Router();

meRouter.use(requireAuth);
meRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const orders = await OrderModel.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      user: publicUser(user),
      cart: publicCart(user),
      orders: orders.map(publicOrder),
    });
  })
);

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

meRouter.get('/cart', (req: Request, res: Response) => {
  res.json({ cart: publicCart(req.user!) });
});

meRouter.put(
  '/cart',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = cartSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'That bag could not be saved');
    const catalog = await resolveCatalog();
    const items = parsed.data.items.filter((item) => catalog[item.productId]);

    const user = req.user!;
    user.set(
      'cart',
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        customizations: item.customizations ?? {},
      }))
    );
    await user.save();

    res.json({ cart: publicCart(user) });
  })
);
