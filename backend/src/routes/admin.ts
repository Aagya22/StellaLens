import { Router, Request, Response } from 'express';
import { isDatabaseReady } from '../config/db';
import { OrderModel, adminOrder, ORDER_STATUSES } from '../models/Order';
import { orderStatusSchema, orderListQuerySchema, customerListQuerySchema } from '../schemas/admin';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { rateLimit } from '../middleware/rateLimit';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { CURRENCY, CATALOG } from '../data/catalog';
import { UserModel } from '../models/User';

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

const EARNING = { status: { $ne: 'cancelled' } };

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localOffset(): string {
  const mins = -new Date().getTimezoneOffset();
  const sign = mins < 0 ? '-' : '+';
  const abs = Math.abs(mins);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

adminRouter.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    assertDatabase();
    const since30 = daysAgo(30);
    const since60 = daysAgo(60);

    const sumRevenue = async (match: Record<string, unknown>) => {
      const [row] = await OrderModel.aggregate<{ minor: number; n: number }>([
        { $match: { ...EARNING, ...match } },
        { $group: { _id: null, minor: { $sum: '$totals.totalMinor' }, n: { $sum: 1 } } },
      ]);
      return { minor: row?.minor ?? 0, n: row?.n ?? 0 };
    };

    const [
      counts, allTime, last30, prev30,
      perDayRows, pieceRows,
      totalUsers, newUsers30, newUsers60, buyerIds,
      recentUsers, ordersPerUser,
    ] = await Promise.all([
      statusCounts(),
      sumRevenue({}),
      sumRevenue({ createdAt: { $gte: since30 } }),
      sumRevenue({ createdAt: { $gte: since60, $lt: since30 } }),
      OrderModel.aggregate<{ _id: string; orders: number; minor: number }>([
        { $match: { createdAt: { $gte: since30 } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: localOffset() } },
            orders: { $sum: 1 },
            minor: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, '$totals.totalMinor'] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      OrderModel.aggregate<{ _id: string; name: string; units: number; minor: number }>([
        { $match: EARNING },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.productId',
            name: { $first: '$items.productName' },
            units: { $sum: '$items.quantity' },
            minor: { $sum: '$items.lineTotalMinor' },
          },
        },
        { $sort: { units: -1, minor: -1 } },
        { $limit: 8 },
      ]),
      UserModel.countDocuments({}),
      UserModel.countDocuments({ createdAt: { $gte: since30 } }),
      UserModel.countDocuments({ createdAt: { $gte: since60, $lt: since30 } }),
      OrderModel.distinct('user', { user: { $ne: null } }),
      UserModel.find({}).sort({ createdAt: -1 }).limit(8).select('name email createdAt'),
      OrderModel.aggregate<{ _id: unknown; n: number }>([
        { $match: { user: { $ne: null } } },
        { $group: { _id: '$user', n: { $sum: 1 } } },
      ]),
    ]);

    const byDay = new Map(perDayRows.map((r) => [r._id, r]));
    const perDay: Array<{ date: string; orders: number; revenueMinor: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const date = dayKey(daysAgo(i));
      const row = byDay.get(date);
      perDay.push({ date, orders: row?.orders ?? 0, revenueMinor: row?.minor ?? 0 });
    }

    const orderCount = new Map(ordersPerUser.map((r) => [String(r._id), r.n]));

    res.json({
      currency: CURRENCY,
      revenue: {
        allTimeMinor: allTime.minor,
        last30Minor: last30.minor,
        prev30Minor: prev30.minor,
        avgOrderMinor: allTime.n ? Math.round(allTime.minor / allTime.n) : 0,
      },
      orders: {
        total: counts.all,
        last30: last30.n,
        prev30: prev30.n,
        byStatus: Object.fromEntries(ORDER_STATUSES.map((s) => [s, counts[s] ?? 0])),
      },
      customers: {
        total: totalUsers,
        last30: newUsers30,
        prev30: newUsers60,
        withOrders: buyerIds.length,
      },
      perDay,
      topPieces: pieceRows.map((row) => ({
        productId: row._id,
        name: CATALOG[row._id]?.name ?? row.name,
        category: CATALOG[row._id]?.category ?? 'unknown',
        units: row.units,
        revenueMinor: row.minor,
      })),
      recentCustomers: recentUsers.map((u) => ({
        name: u.name,
        email: u.email,
        createdAt: u.createdAt,
        orders: orderCount.get(String(u._id)) ?? 0,
      })),
    });
  })
);

adminRouter.get(
  '/customers',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = customerListQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'Invalid filters');
    const { q, page, limit } = parsed.data;
    assertDatabase();

    const filter: Record<string, unknown> = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('name email role earCalibration createdAt'),
      UserModel.countDocuments(filter),
    ]);

    const spend = await OrderModel.aggregate<{ _id: unknown; n: number; minor: number; last: Date }>([
      { $match: { user: { $in: users.map((u) => u._id) }, ...EARNING } },
      { $group: { _id: '$user', n: { $sum: 1 }, minor: { $sum: '$totals.totalMinor' }, last: { $max: '$createdAt' } } },
    ]);
    const byUser = new Map(spend.map((s) => [String(s._id), s]));

    res.json({
      customers: users.map((u) => {
        const s = byUser.get(String(u._id));
        return {
          id: u.id as string,
          name: u.name,
          email: u.email,
          role: u.role ?? 'customer',
          calibrated: Boolean(u.earCalibration),
          createdAt: u.createdAt,
          orders: s?.n ?? 0,
          spentMinor: s?.minor ?? 0,
          lastOrderAt: s?.last ?? null,
        };
      }),
      page, limit, total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  })
);

adminRouter.get(
  '/pieces',
  asyncHandler(async (_req: Request, res: Response) => {
    assertDatabase();
    const rows = await OrderModel.aggregate<{ _id: string; units: number; minor: number; orders: number }>([
      { $match: EARNING },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          units: { $sum: '$items.quantity' },
          minor: { $sum: '$items.lineTotalMinor' },
          orders: { $addToSet: '$_id' },
        },
      },
      { $project: { units: 1, minor: 1, orders: { $size: '$orders' } } },
    ]);
    const sold = new Map(rows.map((r) => [r._id, r]));

    // Every catalogue piece appears, including the ones that have never sold.
    const pieces = Object.values(CATALOG).map((item) => {
      const s = sold.get(item.id);
      return {
        productId: item.id,
        name: item.name,
        category: item.category,
        priceMinor: item.priceMinor,
        units: s?.units ?? 0,
        revenueMinor: s?.minor ?? 0,
        orders: s?.orders ?? 0,
      };
    });
    pieces.sort((a, b) => b.units - a.units || b.revenueMinor - a.revenueMinor);

    res.json({ pieces, currency: CURRENCY });
  })
);

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
