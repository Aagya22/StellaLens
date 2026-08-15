import { Router, Request, Response } from 'express';
import { isDatabaseReady } from '../config/db';
import { OrderModel, generateReference, publicOrder } from '../models/Order';
import { createOrderSchema } from '../schemas/order';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { rateLimit } from '../middleware/rateLimit';
import { requireAuth, attachUser } from '../middleware/auth';
import { CATALOG, CURRENCY, SHIPPING, priceBasket, MAX_QUANTITY_PER_ITEM } from '../data/catalog';

export const ordersRouter = Router();
ordersRouter.get('/config', (_req: Request, res: Response) => {
  res.json({
    currency: CURRENCY,
    deliveryMinor: SHIPPING.deliveryMinor,
    freeDeliveryThresholdMinor: SHIPPING.freeDeliveryThresholdMinor,
    estimatedDays: SHIPPING.estimatedDays,
    maxQuantityPerItem: MAX_QUANTITY_PER_ITEM,
  });
});

ordersRouter.post(
  '/',
  rateLimit({ windowMs: 60_000, max: 10 }),
  attachUser,
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'body';
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      throw new HttpError(400, 'Please check the details entered', fieldErrors);
    }

    const { customer, shipping, items } = parsed.data;

    const unknown = items.filter((item) => !CATALOG[item.productId]);
    if (unknown.length) {
      throw new HttpError(400, 'Your bag contains an item we no longer carry', {
        items: unknown.map((item) => item.productId).join(', '),
      });
    }
    if (!isDatabaseReady()) {
      throw new HttpError(503, 'We cannot take orders right now — please try again shortly');
    }

    const quote = priceBasket(items);
    const order = await OrderModel.create({
      reference: generateReference(),
      user: req.user?._id,
      customer,
      shipping,
      items: quote.lines.map((line, i) => ({
        ...line,
        customizations: items[i].customizations,
      })),
      totals: quote.totals,
    });
    console.info(
      `[orders] ${order.reference} — ${order.items.length} item(s), ` +
      `${quote.totals.totalMinor / 100} ${quote.totals.currency}`
    );

    res.status(201).json({
      message: 'Order placed',
      order: publicOrder(order),
    });
  })
);

ordersRouter.get(
  '/mine',
  attachUser,
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const orders = await OrderModel.find({ user: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ orders: orders.map(publicOrder) });
  })
);
