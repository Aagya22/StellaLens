import { Router, Request, Response } from 'express';
import { isDatabaseReady } from '../config/db';
import { ProductModel, publicProduct } from '../models/Product';
import { asyncHandler } from '../middleware/errorHandler';
import { CURRENCY } from '../data/catalog';

export const productsRouter = Router();

productsRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!isDatabaseReady()) {
      return res.json({ products: [], currency: CURRENCY });
    }

    const products = await ProductModel.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ products: products.map(publicProduct), currency: CURRENCY });
  })
);
