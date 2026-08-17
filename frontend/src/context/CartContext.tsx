'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Product } from '@/data/products';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useCatalog } from '@/context/CatalogContext';
import { useToast } from '@/context/ToastContext';

export interface Customizations {
  topGem?: string;
  bottomGem?: string;
  scale?: string;
  metalTone?: string;
}

export interface CartItem {
  key: string;
  productId: string;
  quantity: number;
  customizations: Customizations;
}

export interface CartLine extends CartItem {
  product: Product;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

const MAX_QUANTITY = 10;

const SAVE_DEBOUNCE_MS = 500;

export const CURRENCY_SYMBOL = 'Rs';
const CURRENCY_DECIMALS = 0;

export function priceToMinor(price: string): number {
  const n = Number(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function formatMoney(minor: number): string {
  return `${CURRENCY_SYMBOL} ${(minor / 100).toLocaleString('en-US', {
    minimumFractionDigits: CURRENCY_DECIMALS,
    maximumFractionDigits: CURRENCY_DECIMALS,
  })}`;
}

function makeKey(productId: string, customizations: Customizations): string {
  const parts = (['topGem', 'bottomGem', 'scale', 'metalTone'] as const)
    .map((k) => customizations[k] ?? '')
    .join('|');
  return parts.replace(/\|+$/, '') ? `${productId}::${parts}` : productId;
}

interface ServerCartItem {
  productId: string;
  quantity: number;
  customizations?: Customizations;
}

function fromServer(items: ServerCartItem[]): CartItem[] {
  return items.map((i) => {
    const customizations = i.customizations ?? {};
    return {
      key: makeKey(i.productId, customizations),
      productId: i.productId,
      quantity: Math.min(MAX_QUANTITY, Math.max(1, i.quantity)),
      customizations,
    };
  });
}

interface CartContextValue {
  items: CartItem[];
  lines: CartLine[];
  count: number;
  subtotalMinor: number;

  ready: boolean;

  saving: boolean;

  add: (productId: string, customizations?: Customizations, quantity?: number) => boolean;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;

  clear: (options?: { persist?: boolean }) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

// The bag lives on the account, not the browser.
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { find: findProduct } = useCatalog();
  const { toast } = useToast();

  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const pending = useRef<CartItem[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const ownerId = useRef<string | null>(null);

  const flush = useCallback(async () => {
    const next = pending.current;
    pending.current = null;
    timer.current = null;
    if (!next || !ownerId.current) return;

    const owner = ownerId.current;
    setSaving(true);
    try {
      await api.put('/api/me/cart', {
        items: next.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          customizations: i.customizations,
        })),
      });
    } catch {
      if (ownerId.current === owner) {
        toastRef.current({
          kind: 'error',
          title: 'Bag not saved',
          message: 'We could not reach the server. Your changes may not appear on other devices.',
        });
      }
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleSave = useCallback((next: CartItem[]) => {
    if (!ownerId.current) return;
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }, [flush]);

  const mutate = useCallback(
    (updater: (prev: CartItem[]) => CartItem[]) => {
      setItems((prev) => {
        const next = updater(prev);
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      ownerId.current = null;
      pending.current = null;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      setItems([]);
      setReady(true);
      return;
    }

    let cancelled = false;
    ownerId.current = user.id;
    setReady(false);
    api
      .get<{ cart: ServerCartItem[] }>('/api/me/cart')
      .then((res) => { if (!cancelled) setItems(fromServer(res.cart)); })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        toastRef.current({
          kind: 'error',
          title: 'Bag unavailable',
          message: 'We could not load your saved bag. Try again in a moment.',
        });
      })
      .finally(() => { if (!cancelled) setReady(true); });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const add = useCallback(
    (productId: string, customizations: Customizations = {}, quantity = 1): boolean => {
      if (!ownerId.current) return false;
      const key = makeKey(productId, customizations);
      mutate((prev) => {
        const existing = prev.find((i) => i.key === key);
        if (existing) {
          return prev.map((i) =>
            i.key === key
              ? { ...i, quantity: Math.min(MAX_QUANTITY, i.quantity + quantity) }
              : i
          );
        }
        return [...prev, { key, productId, quantity: Math.min(MAX_QUANTITY, quantity), customizations }];
      });
      return true;
    },
    [mutate]
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) => {
      mutate((prev) =>
        quantity <= 0
          ? prev.filter((i) => i.key !== key)
          : prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(MAX_QUANTITY, quantity) } : i))
      );
    },
    [mutate]
  );

  const remove = useCallback(
    (key: string) => mutate((prev) => prev.filter((i) => i.key !== key)),
    [mutate]
  );

  const clear = useCallback(
    (options?: { persist?: boolean }) => {
      if (options?.persist === false) {
        pending.current = null;
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        setItems([]);
        return;
      }
      mutate(() => []);
    },
    [mutate]
  );

  const lines = useMemo<CartLine[]>(() => {
    return items.flatMap((item) => {
      const product = findProduct(item.productId);
      if (!product) return [];
      const unitPriceMinor = priceToMinor(product.price);
      return [{
        ...item,
        product,
        unitPriceMinor,
        lineTotalMinor: unitPriceMinor * item.quantity,
      }];
    });
  }, [items, findProduct]);

  const count = useMemo(() => lines.reduce((n, l) => n + l.quantity, 0), [lines]);
  const subtotalMinor = useMemo(
    () => lines.reduce((sum, l) => sum + l.lineTotalMinor, 0),
    [lines]
  );

  const value = useMemo(
    () => ({ items, lines, count, subtotalMinor, ready, saving, add, setQuantity, remove, clear }),
    [items, lines, count, subtotalMinor, ready, saving, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

export { MAX_QUANTITY };
