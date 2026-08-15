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
    earCalibration: { type: earCalibrationSchema, default: null },
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
    earCalibration: user.earCalibration ?? null,
    createdAt: user.createdAt,
  };
}
