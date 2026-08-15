'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { PRODUCTS, Product } from '@/data/products';

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

const STORAGE_KEY = 'stellalens.cart.v1';
const MAX_QUANTITY = 10;

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

interface CartContextValue {
  items: CartItem[];
  lines: CartLine[];
  count: number;
  subtotalMinor: number;
  /** False until localStorage has been read, so the badge doesn't flash 0. */
  ready: boolean;
  add: (productId: string, customizations?: Customizations, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setItems(
          parsed.filter(
            (i) => i && typeof i.productId === 'string' && PRODUCTS.some((p) => p.id === i.productId)
          )
        );
      }
    } catch {

    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return; 
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
    }
  }, [items, ready]);

  const add = useCallback(
    (productId: string, customizations: Customizations = {}, quantity = 1) => {
      const key = makeKey(productId, customizations);
      setItems((prev) => {
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
    },
    []
  );

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.key !== key)
        : prev.map((i) => (i.key === key ? { ...i, quantity: Math.min(MAX_QUANTITY, quantity) } : i))
    );
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const lines = useMemo<CartLine[]>(() => {
    return items.flatMap((item) => {
      const product = PRODUCTS.find((p) => p.id === item.productId);
      if (!product) return [];
      const unitPriceMinor = priceToMinor(product.price);
      return [{
        ...item,
        product,
        unitPriceMinor,
        lineTotalMinor: unitPriceMinor * item.quantity,
      }];
    });
  }, [items]);

  const count = useMemo(() => items.reduce((n, i) => n + i.quantity, 0), [items]);
  const subtotalMinor = useMemo(
    () => lines.reduce((sum, l) => sum + l.lineTotalMinor, 0),
    [lines]
  );

  const value = useMemo(
    () => ({ items, lines, count, subtotalMinor, ready, add, setQuantity, remove, clear }),
    [items, lines, count, subtotalMinor, ready, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}

export { MAX_QUANTITY };
