import { z } from 'zod';
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES } from '../models/Product';

const priceMinor = z.coerce
  .number()
  .int('Enter a whole rupee amount')
  .min(0, 'A price cannot be negative')
  .max(1_000_000_00, 'That price looks wrong — check the amount');

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => v === '' || /^https:\/\/res\.cloudinary\.com\//.test(v),
    'Images must be uploaded, not linked'
  );

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Give the piece a name').max(120),
  category: z.enum(PRODUCT_CATEGORIES),
  description: z.string().trim().max(300).default(''),
  priceMinor,
  imageUrl: imageUrl.default(''),
  imagePublicId: z.string().trim().max(300).default(''),
  status: z.enum(PRODUCT_STATUSES).default('active'),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2, 'Give the piece a name').max(120),
    category: z.enum(PRODUCT_CATEGORIES),
    description: z.string().trim().max(300),
    priceMinor,
    imageUrl,
    imagePublicId: z.string().trim().max(300),
    status: z.enum(PRODUCT_STATUSES),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change');

export const productListQuerySchema = z.object({
  status: z.enum(PRODUCT_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
});
