import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().max(max);

export const createOrderSchema = z.object({
  name: trimmed(120).min(1, 'Name is required'),
  email: trimmed(200).email('Enter a valid email address'),
  phone: trimmed(40).min(5, 'Enter a valid phone number'),
  address: trimmed(500).min(5, 'Address is required'),

  productId: trimmed(100).min(1, 'productId is required'),
  productName: trimmed(200).min(1, 'productName is required'),
  price: trimmed(50).min(1, 'price is required'),

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
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
