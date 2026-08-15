import { z } from 'zod';
import { MAX_QUANTITY_PER_ITEM } from '../data/catalog';

const customizations = z
  .object({
    topGem: z.string().trim().max(60).optional(),
    bottomGem: z.string().trim().max(60).optional(),
    scale: z.string().trim().max(60).optional(),
    metalTone: z.string().trim().max(60).optional(),
  })
  .optional();

export const cartItemSchema = z.object({
  productId: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
  customizations,
});

export const cartSchema = z.object({
  items: z.array(cartItemSchema).max(50),
});

export type CartItemInput = z.infer<typeof cartItemSchema>;
