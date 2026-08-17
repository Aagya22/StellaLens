import { z } from 'zod';
import { ORDER_STATUSES } from '../models/Order';

export const orderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const orderListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
