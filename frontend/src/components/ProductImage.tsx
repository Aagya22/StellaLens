'use client';

import { useState } from 'react';
import { Product } from '@/data/products';

interface ProductImageProps {
  product: Product;
  className?: string;

  fallbackSize?: number;
}

// Falls back to the piece's initial until a photo file exists.
export default function ProductImage({
  product,
  className = 'w-full h-full object-cover',
  fallbackSize = 70,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!product.image || failed) {
    return (
      <span
        className="font-editorial text-[#f2f2f2] select-none leading-none transition-all duration-500 group-hover:text-[#c5a880]/15 group-hover:scale-[1.06]"
        style={{
          fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
          fontSize: `${fallbackSize}px`,
        }}
        aria-label={product.name}
      >
        {product.name.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={product.image}
      alt={product.name}
      className={className}
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}
