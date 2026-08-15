export interface CatalogItem {
  id: string;
  name: string;
  category: 'earrings' | 'necklaces' | 'rings' | 'bracelets';
  /** Paisa. Named "minor" rather than "paisa" so switching currency later
      doesn't leave a misnamed field behind. */
  priceMinor: number;
}

export const CURRENCY = 'NPR';
export const CURRENCY_SYMBOL = 'Rs';
export const CURRENCY_DECIMALS = 0;

export const CATALOG: Record<string, CatalogItem> = {
  earring_diamond: { id: 'earring_diamond', name: 'Astraea Diamond Drops', category: 'earrings', priceMinor: 125_000 },
  earring_gold_hoop: { id: 'earring_gold_hoop', name: 'Lunette Golden Hoops', category: 'earrings', priceMinor: 65_000 },
  earring_selene: { id: 'earring_selene', name: 'Selene Studs', category: 'earrings', priceMinor: 78_000 },
  earring_anarkali: { id: 'earring_anarkali', name: 'Anarkali Drops', category: 'earrings', priceMinor: 105_000 },
  earring_raflesia: { id: 'earring_raflesia', name: 'Raflesia Two-Layer Drops', category: 'earrings', priceMinor: 118_000 },
  necklace_orlaith: { id: 'necklace_orlaith', name: 'Orlaith Celestial Chain', category: 'necklaces', priceMinor: 180_000 },
  necklace_locket: { id: 'necklace_locket', name: 'Luna Locket', category: 'necklaces', priceMinor: 115_000 },
  necklace_vega: { id: 'necklace_vega', name: 'Vega Beaded Necklace', category: 'necklaces', priceMinor: 125_000 },
  ring_polaris: { id: 'ring_polaris', name: 'Polaris Solitaire', category: 'rings', priceMinor: 240_000 },
  ring_rosanna: { id: 'ring_rosanna', name: 'Rosanna Pavé Band', category: 'rings', priceMinor: 160_000 },
  ring_silver_moon: { id: 'ring_silver_moon', name: 'Silver Moon Ring', category: 'rings', priceMinor: 190_000 },
  bracelet_lyra: { id: 'bracelet_lyra', name: 'Lyra Topaz Weave', category: 'bracelets', priceMinor: 135_000 },
  bracelet_aurelia: { id: 'bracelet_aurelia', name: 'Aurelia Bangle', category: 'bracelets', priceMinor: 110_000 },
};
export const SHIPPING = {
  deliveryMinor: 2_500,
  freeDeliveryThresholdMinor: 200_000,
  estimatedDays: '5–7 business days',
};

export const MAX_QUANTITY_PER_ITEM = 10;

export function formatMoney(minor: number): string {
  return `${CURRENCY_SYMBOL} ${(minor / 100).toLocaleString('en-US', {
    minimumFractionDigits: CURRENCY_DECIMALS,
    maximumFractionDigits: CURRENCY_DECIMALS,
  })}`;
}

export interface QuoteLine {
  productId: string;
  productName: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
}
export interface OrderTotals {
  subtotalMinor: number;
  deliveryMinor: number;
  totalMinor: number;
  currency: string;
}

export interface Quote {
  lines: QuoteLine[];
  totals: OrderTotals;
}

export function priceBasket(
  items: Array<{ productId: string; quantity: number }>
): Quote {
  const lines: QuoteLine[] = items.map((item) => {
    const product = CATALOG[item.productId];
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    return {
      productId: product.id,
      productName: product.name,
      unitPriceMinor: product.priceMinor,
      quantity: item.quantity,
      lineTotalMinor: product.priceMinor * item.quantity,
    };
  });

  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
  const deliveryMinor =
    subtotalMinor >= SHIPPING.freeDeliveryThresholdMinor ? 0 : SHIPPING.deliveryMinor;

  return {
    lines,
    totals: {
      subtotalMinor,
      deliveryMinor,
      totalMinor: subtotalMinor + deliveryMinor,
      currency: CURRENCY,
    },
  };
}
