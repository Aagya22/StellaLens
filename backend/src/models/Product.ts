import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

export const PRODUCT_CATEGORIES = ['earrings', 'necklaces', 'rings', 'bracelets'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_STATUSES = ['active', 'hidden', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

const productSchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, trim: true, maxlength: 80 },

    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, enum: PRODUCT_CATEGORIES, index: true },
    description: { type: String, default: '', trim: true, maxlength: 300 },

    priceMinor: { type: Number, required: true, min: 0 },

    imageUrl: { type: String, default: '', trim: true, maxlength: 500 },
    imagePublicId: { type: String, default: '', trim: true, maxlength: 300 },

    status: { type: String, enum: PRODUCT_STATUSES, default: 'active', index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, createdAt: -1 });

export type Product = InferSchemaType<typeof productSchema>;
export type ProductDocument = HydratedDocument<Product>;

export const ProductModel = model('Product', productSchema);

export function slugifyId(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return base || `piece_${Date.now().toString(36)}`;
}

export function publicProduct(p: ProductDocument) {
  return {
    id: p.productId,
    name: p.name,
    category: p.category,
    priceMinor: p.priceMinor,
    description: p.description,
    image: p.imageUrl,
  };
}

export function adminProduct(p: ProductDocument) {
  return {
    id: p.productId,
    name: p.name,
    category: p.category,
    priceMinor: p.priceMinor,
    description: p.description,
    image: p.imageUrl,
    imagePublicId: p.imagePublicId,
    status: p.status,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
