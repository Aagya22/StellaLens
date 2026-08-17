import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isDatabaseReady } from '../config/db';
import { ProductModel, adminProduct, slugifyId, PRODUCT_STATUSES } from '../models/Product';
import { OrderModel } from '../models/Order';
import { CATALOG, CURRENCY } from '../data/catalog';
import { createProductSchema, updateProductSchema, productListQuerySchema } from '../schemas/product';
import { HttpError, asyncHandler } from '../middleware/errorHandler';
import { cloudinaryReady, createUploadTicket, destroyImage } from '../lib/cloudinary';

// Mounted inside adminRouter, so the admin guard and rate limit already apply.
export const adminProductsRouter = Router();

function assertDatabase(): void {
  if (!isDatabaseReady()) throw new HttpError(503, 'The database is unavailable right now');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const field = issue.path.join('.') || 'form';
    if (!out[field]) out[field] = issue.message;
  }
  return out;
}

// Ids must be unique across both catalogues, since orders key on them alone.
async function claimId(name: string): Promise<string> {
  const base = slugifyId(name);
  for (let n = 0; n < 50; n += 1) {
    const candidate = n === 0 ? base : `${base}_${n + 1}`;
    if (CATALOG[candidate]) continue;
    const clash = await ProductModel.exists({ productId: candidate });
    if (!clash) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`;
}

adminProductsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = productListQuerySchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'Invalid filters');
    const { status, q, page, limit } = parsed.data;
    assertDatabase();

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: rx }, { productId: rx }, { description: rx }];
    }

    const [products, total, rows] = await Promise.all([
      ProductModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      ProductModel.countDocuments(filter),
      ProductModel.aggregate<{ _id: string; n: number }>([
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
    ]);

    const counts: Record<string, number> = { all: 0 };
    for (const s of PRODUCT_STATUSES) counts[s] = 0;
    for (const row of rows) {
      counts[row._id] = row.n;
      counts.all += row.n;
    }

    res.json({
      products: products.map(adminProduct),
      counts,
      currency: CURRENCY,
      uploadsEnabled: cloudinaryReady,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  })
);

// Handed to the browser so it can upload straight to Cloudinary.
adminProductsRouter.post(
  '/upload-signature',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!cloudinaryReady) {
      throw new HttpError(503, 'Image uploads are not configured on this server yet');
    }
    res.json(createUploadTicket());
  })
);

adminProductsRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the details entered', fieldErrors(parsed.error));
    }
    assertDatabase();

    const data = parsed.data;
    const product = await ProductModel.create({
      productId: await claimId(data.name),
      name: data.name,
      category: data.category,
      description: data.description,
      priceMinor: data.priceMinor,
      imageUrl: data.imageUrl,
      imagePublicId: data.imagePublicId,
      status: data.status,
      createdBy: req.user!._id,
    });

    console.info(`[admin] piece added: ${product.productId} by ${req.user!.email}`);
    res.status(201).json({ product: adminProduct(product) });
  })
);

adminProductsRouter.patch(
  '/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the details entered', fieldErrors(parsed.error));
    }
    assertDatabase();

    const product = await ProductModel.findOne({ productId: req.params.productId });
    if (!product) throw new HttpError(404, 'No piece with that id');

    const data = parsed.data;
    const oldPublicId = product.imagePublicId;
    const replacingImage =
      data.imagePublicId !== undefined && data.imagePublicId !== oldPublicId;
    product.set(data);
    await product.save();

    if (replacingImage && oldPublicId) void destroyImage(oldPublicId);

    res.json({ product: adminProduct(product) });
  })
);

adminProductsRouter.delete(
  '/:productId',
  asyncHandler(async (req: Request, res: Response) => {
    assertDatabase();

    const product = await ProductModel.findOne({ productId: req.params.productId });
    if (!product) throw new HttpError(404, 'No piece with that id');
    const sold = await OrderModel.exists({ 'items.productId': product.productId });
    if (sold) {
      throw new HttpError(
        409,
        'This piece has already been ordered — archive it instead of deleting it'
      );
    }

    const publicId = product.imagePublicId;
    await product.deleteOne();
    if (publicId) void destroyImage(publicId);

    console.info(`[admin] piece deleted: ${product.productId} by ${req.user!.email}`);
    res.json({ deleted: product.productId });
  })
);
