import { Router, Request, Response } from 'express';
import { isDatabaseReady } from '../config/db';
import { OrderModel, adminOrder, ORDER_STATUSES } from '../models/Order';
import { orderStatusSchema, orderListQuerySchema } from '../schemas/admin';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { rateLimit } from '../middleware/rateLimit';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { CURRENCY } from '../data/catalog';

export const adminRouter = Router();

adminRouter.use(rateLimit({ windowMs: 60_000, max: 120 }));
adminRouter.use(requireAuth, requireAdmin);

function assertDatabase(): void {
  if (!isDatabaseReady()) throw new HttpError(503, 'The database is unavailable right now');
}

// Search is a user-supplied string dropped into a regex, so it must be escaped.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function statusCounts(): Promise<Record<string, number>> {
  const rows = await OrderModel.aggregate<{ _id: string; n: number }>([
    { $group: { _id: '$status', n: { $sum: 1 } } },
  ]);
  const counts: Record<string, number> = { all: 0 };
  for (const s of ORDER_STATUSES) counts[s] = 0;
  for (const row of rows) {
    counts[row._id] = row.n;
    counts.all += row.n;
  }
  return counts;
}

adminRouter.get(
  '/orders',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = orderListQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'Invalid filters');
    const { status, q, page, limit } = parsed.data;
    assertDatabase();

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ reference: rx }, { 'customer.name': rx }, { 'customer.email': rx }];
    }

    const [orders, total, counts] = await Promise.all([
      OrderModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      OrderModel.countDocuments(filter),
      statusCounts(),
    ]);

    res.json({
      orders: orders.map((order) => ({
        reference: order.reference,
        status: order.status,
        customerName: order.customer?.name ?? '',
        customerEmail: order.customer?.email ?? '',
        itemCount: order.items.reduce((n, item) => n + item.quantity, 0),
        totalMinor: order.totals?.totalMinor ?? 0,
        currency: order.totals?.currency ?? CURRENCY,
        createdAt: order.createdAt,
      })),
      counts,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  })
);

adminRouter.get(
  '/orders/:reference',
  asyncHandler(async (req: Request, res: Response) => {
    assertDatabase();
    const order = await OrderModel.findOne({ reference: req.params.reference });
    if (!order) throw new HttpError(404, 'No order with that reference');
    res.json({ order: adminOrder(order) });
  })
);

adminRouter.patch(
  '/orders/:reference/status',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = orderStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, `Status must be one of: ${ORDER_STATUSES.join(', ')}`);
    }
    assertDatabase();

    const order = await OrderModel.findOne({ reference: req.params.reference });
    if (!order) throw new HttpError(404, 'No order with that reference');

    const from = order.status;
    if (from === parsed.data.status) {
      return res.json({ order: adminOrder(order) });
    }

    order.status = parsed.data.status;
    await order.save();
    console.info(
      `[admin] ${order.reference} ${from} → ${order.status} by ${req.user!.email}`
    );

    res.json({ order: adminOrder(order) });
  })
);
