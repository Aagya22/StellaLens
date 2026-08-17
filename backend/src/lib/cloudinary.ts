import { createHash } from 'crypto';
import { env } from '../config/env';

export const cloudinaryReady = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

function sign(params: Record<string, string | number>): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(canonical + env.CLOUDINARY_API_SECRET).digest('hex');
}

export interface UploadTicket {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
  uploadUrl: string;
}

export function createUploadTicket(): UploadTicket {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = env.CLOUDINARY_FOLDER;

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    folder,
    timestamp,
    signature: sign({ folder, timestamp }),
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  };
}

export async function destroyImage(publicId: string): Promise<void> {
  if (!cloudinaryReady || !publicId) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const body = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: env.CLOUDINARY_API_KEY,
    signature: sign({ public_id: publicId, timestamp }),
  });

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
      { method: 'POST', body }
    );
    if (!res.ok) {
      console.warn(`[cloudinary] destroy ${publicId} returned ${res.status}`);
    }
  } catch (err) {
    console.warn(`[cloudinary] destroy ${publicId} failed:`, (err as Error).message);
  }
}
