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
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

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
