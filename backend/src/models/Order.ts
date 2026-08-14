import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

/* Mirrors the AR view's customization panel. Optional throughout — a plain
   piece with no options chosen is a perfectly valid order. */
const customizationsSchema = new Schema(
  {
    topGem: { type: String, trim: true },
    bottomGem: { type: String, trim: true },
    scale: { type: String, trim: true },
    metalTone: { type: String, trim: true },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {

    reference: { type: String, required: true, unique: true },

    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    address: { type: String, required: true, trim: true, maxlength: 500 },

    productId: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },

    price: { type: String, required: true, trim: true },

    customizations: { type: customizationsSchema, default: {} },

    status: {
      type: String,
      enum: ['new', 'contacted', 'fulfilled', 'cancelled'],
      default: 'new',
    },
  },
  { timestamps: true }
);

// Newest-first listing for whatever admin view comes later.
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export type Order = InferSchemaType<typeof orderSchema>;
export type OrderDocument = HydratedDocument<Order>;

export const OrderModel = model('Order', orderSchema);

/** Short, unambiguous, and sortable by time: SL-<base36 time>-<random>. */
export function generateReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const salt = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SL-${stamp}-${salt}`;
}
