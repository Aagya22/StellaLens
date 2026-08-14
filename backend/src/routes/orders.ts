import { Router, Request, Response } from 'express';
import { isDatabaseReady } from '../config/db';
import { OrderModel, generateReference } from '../models/Order';
import { createOrderSchema } from '../schemas/order';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { rateLimit } from '../middleware/rateLimit';

export const ordersRouter = Router();

ordersRouter.post(
  '/',
  rateLimit({ windowMs: 60_000, max: 10 }),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      // Field-keyed messages so the form can show them next to the inputs.
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.') || 'body';
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      throw new HttpError(400, 'Please check the details entered', fieldErrors);
    }

    // Never report success for an order we couldn't store — a lost bespoke
    // enquiry is a lost customer who thinks they've already been in touch.
    if (!isDatabaseReady()) {
      throw new HttpError(503, 'We cannot take orders right now — please try again shortly');
    }

    const order = await OrderModel.create({
      ...parsed.data,
      reference: generateReference(),
    });

    // Deliberately no customer contact details in the logs.
    console.info(`[orders] ${order.reference} — ${order.productName}`);

    res.status(201).json({
      message: 'Bespoke order request received',
      data: {
        reference: order.reference,
        productName: order.productName,
        price: order.price,
        createdAt: order.createdAt,
      },
    });
  })
);
