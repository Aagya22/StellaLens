import { Schema, model, InferSchemaType, HydratedDocument, Types } from 'mongoose';

const customizationsSchema = new Schema(
  {
    topGem: { type: String, trim: true },
    bottomGem: { type: String, trim: true },
    scale: { type: String, trim: true },
    metalTone: { type: String, trim: true },
  },
  { _id: false }
);
const orderItemSchema = new Schema(
  {
    productId: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalMinor: { type: Number, required: true, min: 0 },
    customizations: { type: customizationsSchema, default: {} },
  },
  { _id: false }
);

const shippingSchema = new Schema(
  {
    address: { type: String, required: true, trim: true, maxlength: 300 },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true },

    user: { type: Schema.Types.ObjectId, ref: 'User' },

    customer: {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
      phone: { type: String, required: true, trim: true, maxlength: 40 },
    },

    shipping: { type: shippingSchema, required: true },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(v: unknown[]) => v.length > 0, 'An order needs at least one item'],
    },
    totals: {
      subtotalMinor: { type: Number, required: true, min: 0 },
      deliveryMinor: { type: Number, required: true, min: 0 },
      totalMinor: { type: Number, required: true, min: 0 },
      currency: { type: String, required: true, default: 'NPR' },
    },

    status: {
      type: String,
      enum: ['new', 'contacted', 'fulfilled', 'cancelled'],
      default: 'new',
    },
  },
  { timestamps: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });

export type Order = InferSchemaType<typeof orderSchema>;
export type OrderDocument = HydratedDocument<Order>;

export const OrderModel = model('Order', orderSchema);

/** Short, unambiguous, and sortable by time: SL-<base36 time>-<random>. */
export function generateReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const salt = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SL-${stamp}-${salt}`;
}

/** What may be returned to the customer who placed it. */
export function publicOrder(order: OrderDocument) {
  return {
    reference: order.reference,
    status: order.status,
    items: order.items,
    shipping: order.shipping,
    totals: order.totals,
    createdAt: order.createdAt,
  };
}

export type OrderUserRef = Types.ObjectId | undefined;
