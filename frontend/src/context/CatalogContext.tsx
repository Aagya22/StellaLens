'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PRODUCTS, Product } from '@/data/products';
import { api, ShopProduct } from '@/lib/api';

const CURRENCY_SYMBOL = 'Rs';

function formatPrice(minor: number): string {
  return `${CURRENCY_SYMBOL} ${(minor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}
function toProduct(row: ShopProduct): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: formatPrice(row.priceMinor),
    description: row.description,
    modelPath: '',
    arEnabled: false,
    image: row.image,
  };
}

interface CatalogValue {
  products: Product[];
  find: (id: string) => Product | undefined;
  loaded: boolean;
  refresh: () => Promise<void>;
}

const CatalogContext = createContext<CatalogValue | null>(null);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [added, setAdded] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ products: ShopProduct[] }>('/api/products');

      setAdded(res.products.filter((r) => !PRODUCTS.some((p) => p.id === r.id)).map(toProduct));
    } catch {

    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const products = useMemo(() => [...PRODUCTS, ...added], [added]);
  const find = useCallback((id: string) => products.find((p) => p.id === id), [products]);

  const value = useMemo(
    () => ({ products, find, loaded, refresh }),
    [products, find, loaded, refresh]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog must be used inside <CatalogProvider>');
  return ctx;
}
