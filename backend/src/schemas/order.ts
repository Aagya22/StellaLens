import { z } from 'zod';
import { MAX_QUANTITY_PER_ITEM } from '../data/catalog';

const trimmed = (max: number) => z.string().trim().max(max);
export const createOrderSchema = z.object({
  customer: z.object({
    name: trimmed(120).min(1, 'Name is required'),
    email: trimmed(200).email('Enter a valid email address'),
    phone: trimmed(40).min(5, 'Enter a valid phone number'),
  }),

  shipping: z.object({
    address: trimmed(300).min(5, 'Address is required'),
    city: trimmed(120).min(1, 'City is required'),
    postalCode: trimmed(20).min(1, 'Postal code is required'),
    country: trimmed(120).min(1, 'Country is required'),
    notes: trimmed(500).optional(),
  }),

  items: z
    .array(
      z.object({
        productId: trimmed(100).min(1),
        quantity: z
          .number()
          .int('Quantity must be a whole number')
          .min(1, 'Quantity must be at least 1')
          .max(MAX_QUANTITY_PER_ITEM, `Maximum ${MAX_QUANTITY_PER_ITEM} per item`),
        customizations: z
          .object({
            topGem: trimmed(60).optional(),
            bottomGem: trimmed(60).optional(),
            scale: trimmed(20).optional(),
            metalTone: trimmed(30).optional(),
          })
          .strip()
          .optional()
          .default({}),
      })
    )
    .min(1, 'Your bag is empty')
    .max(50, 'Too many items in one order'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
