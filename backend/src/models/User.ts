import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';

const lobePointSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true },
  },
  { _id: false }
);

const earCalibrationSchema = new Schema(
  {
    screenLeft: { type: lobePointSchema, required: true },
    screenRight: { type: lobePointSchema, required: true },
    calibratedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cartCustomizationsSchema = new Schema(
  {
    topGem: { type: String, trim: true },
    bottomGem: { type: String, trim: true },
    scale: { type: String, trim: true },
    metalTone: { type: String, trim: true },
  },
  { _id: false }
);
const cartItemSchema = new Schema(
  {
    productId: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    customizations: { type: cartCustomizationsSchema, default: {} },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 200,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer', index: true },
    earCalibration: { type: earCalibrationSchema, default: null },
    cart: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<User>;

export const UserModel = model('User', userSchema);

export function publicUser(user: UserDocument) {
  return {
    id: user.id as string,
    name: user.name,
    email: user.email,
    role: user.role ?? 'customer',
    earCalibration: user.earCalibration ?? null,
    createdAt: user.createdAt,
  };
}

export function publicCart(user: UserDocument) {
  return user.cart.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    customizations: item.customizations ?? {},
  }));
}
