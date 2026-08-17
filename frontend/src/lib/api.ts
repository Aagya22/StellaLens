const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      ...init,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error ?? `Request failed (${res.status})`,
      body?.details
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const ORDER_STATUSES = ['new', 'contacted', 'fulfilled', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PRODUCT_CATEGORIES = ['earrings', 'necklaces', 'rings', 'bracelets'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_STATUSES = ['active', 'hidden', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export interface ShopProduct {
  id: string;
  name: string;
  category: ProductCategory;
  priceMinor: number;
  description: string;
  image: string;
}

export interface AdminProduct extends ShopProduct {
  imagePublicId: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminProductList {
  products: AdminProduct[];
  counts: Record<string, number>;
  currency: string;
  uploadsEnabled: boolean;
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface UploadTicket {
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  signature: string;
  uploadUrl: string;
}

export interface UploadedImage {
  url: string;
  publicId: string;
}

export async function uploadProductImage(file: File): Promise<UploadedImage> {
  const ticket = await api.post<UploadTicket>('/api/admin/products/upload-signature');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', ticket.apiKey);
  form.append('timestamp', String(ticket.timestamp));
  form.append('folder', ticket.folder);
  form.append('signature', ticket.signature);

  const res = await fetch(ticket.uploadUrl, { method: 'POST', body: form });
  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.secure_url) {
    throw new ApiError(res.status, body?.error?.message ?? 'That image could not be uploaded');
  }
  return { url: body.secure_url as string, publicId: body.public_id as string };
}

export interface AdminOrderRow {
  reference: string;
  status: OrderStatus;
  customerName: string;
  customerEmail: string;
  itemCount: number;
  totalMinor: number;
  currency: string;
  createdAt: string;
}

export interface AdminOrderList {
  orders: AdminOrderRow[];
  counts: Record<string, number>;
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AdminNotifications {
  since: string;
  customers: {
    count: number;
    items: Array<{ id: string; name: string; email: string; createdAt: string }>;
  };
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  calibrated: boolean;
  createdAt: string;
  orders: number;
  spentMinor: number;
  lastOrderAt: string | null;
}

export interface AdminCustomerList {
  customers: AdminCustomer[];
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface AdminPiece {
  productId: string;
  name: string;
  category: string;
  priceMinor: number;
  units: number;
  revenueMinor: number;
  orders: number;
}

export interface AdminStats {
  currency: string;
  revenue: { allTimeMinor: number; last30Minor: number; prev30Minor: number; avgOrderMinor: number };
  orders: { total: number; last30: number; prev30: number; byStatus: Record<OrderStatus, number> };
  customers: { total: number; last30: number; prev30: number; withOrders: number };
  perDay: Array<{ date: string; orders: number; revenueMinor: number }>;
  topPieces: Array<{ productId: string; name: string; category: string; units: number; revenueMinor: number }>;
  recentCustomers: Array<{ name: string; email: string; createdAt: string; orders: number }>;
}

export interface AdminOrderDetail {
  id: string;
  reference: string;
  status: OrderStatus;
  customer: { name: string; email: string; phone: string };
  shipping: { address: string; city: string; postalCode: string; country: string; notes?: string };
  items: OrderItem[];
  totals: { subtotalMinor: number; deliveryMinor: number; totalMinor: number; currency: string };
  createdAt: string;
  updatedAt: string;
}

export interface LobePoint {
  x: number;
  y: number;
  z: number;
}

export interface EarCalibration {
  screenLeft: LobePoint;
  screenRight: LobePoint;
  calibratedAt?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin';
  earCalibration: EarCalibration | null;
  createdAt?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  customizations?: Record<string, string | undefined>;
}

export interface OrderTotals {
  subtotalMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  currency: string;
}

export interface PastOrder {
  reference: string;
  status: 'new' | 'contacted' | 'fulfilled' | 'cancelled';
  items: OrderItem[];
  shipping: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
    notes?: string;
  };
  totals: OrderTotals;
  createdAt: string;
}
