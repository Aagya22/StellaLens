'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Product } from '@/data/products';
import ProductImage from '@/components/ProductImage';

interface ProductDetailProps {
  product: Product;
  related: Product[];
  canAddToCart: boolean;
  onBack: () => void;
  onTryOn: (product: Product) => void;
  onAddToCart: (product: Product) => boolean;
  onSelect: (product: Product) => void;
}

const CATEGORY_LABEL: Record<Product['category'], string> = {
  earrings: 'Earrings',
  necklaces: 'Necklaces',
  rings: 'Rings',
  bracelets: 'Bracelets',
};

const INK = '#141414';
const MUTED = '#6b6b6b';
const ACCENT = 'var(--cream-text)';
const GOLD = '#c5a880';
const GOLD_DEEP = '#a9885f';
const GOLD_FADE = 'rgba(197,168,128,0.45)';
const LINE = 'rgba(0,0,0,0.09)';

const NAV_CLEARANCE = '64px';

const label: React.CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '10px',
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
};

const body: React.CSSProperties = { fontFamily: 'var(--font-jost), sans-serif' };

function Band({
  children, background, borderTop, borderBottom, padY,
}: {
  children: React.ReactNode; background?: string;
  borderTop?: boolean; borderBottom?: boolean; padY?: string;
}) {
  return (
    <div
      className="w-full flex justify-center"
      style={{
        background,
        borderTop: borderTop ? `1px solid ${LINE}` : undefined,
        borderBottom: borderBottom ? `1px solid ${LINE}` : undefined,
      }}
    >
      <div
        className="w-full max-w-6xl px-6 sm:px-12"
        style={{ paddingTop: padY, paddingBottom: padY }}
      >
        {children}
      </div>
    </div>
  );
}

function Corners() {
  const c = { position: 'absolute' as const, width: '14px', height: '14px', pointerEvents: 'none' as const, zIndex: 2 };
  const s = `1px solid ${GOLD_FADE}`;
  return (
    <>
      <span style={{ ...c, top: 14, left: 14, borderTop: s, borderLeft: s }} />
      <span style={{ ...c, top: 14, right: 14, borderTop: s, borderRight: s }} />
      <span style={{ ...c, bottom: 14, left: 14, borderBottom: s, borderLeft: s }} />
      <span style={{ ...c, bottom: 14, right: 14, borderBottom: s, borderRight: s }} />
    </>
  );
}

export default function ProductDetail({
  product, related, canAddToCart, onBack, onTryOn, onAddToCart, onSelect,
}: ProductDetailProps) {
  const [justAdded, setJustAdded] = useState(false);

  const addToBag = () => {
    if (!onAddToCart(product)) return;
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <section className="w-full flex flex-col relative z-10" style={{ background: '#f6f5f3' }}>
      <div
        className="w-full flex justify-center"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'rgba(246,245,243,0.93)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${LINE}`,
          paddingTop: `calc(${NAV_CLEARANCE} + 14px)`,
          paddingBottom: '14px',
        }}
      >
        <div className="w-full max-w-6xl px-6 sm:px-12">
          <button
            onClick={onBack}
            className="cursor-pointer inline-flex items-center gap-2.5"
            style={{
              ...label,
              background: 'transparent',
              border: `1px solid ${LINE}`,
              borderRadius: '999px',
              padding: '10px 20px',
              color: MUTED,
              transition: 'all 0.25s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = INK; e.currentTarget.style.borderColor = GOLD_FADE; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = LINE; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All Jewelry
          </button>
        </div>
      </div>

      <Band padY="clamp(36px, 5vw, 68px)">
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start"
        >
          <div className="md:sticky" style={{ top: '96px' }}>
            <div
              className="relative w-full aspect-square overflow-hidden bg-white flex items-center justify-center"
              style={{ border: `1px solid ${LINE}`, boxShadow: '0 10px 40px -14px rgba(107,11,20,0.18)' }}
            >
              <Corners />
              <ProductImage
                product={product}
                className="absolute inset-0 w-full h-full object-cover"
                fallbackSize={150}
              />
            </div>
          </div>

          <div className="flex flex-col" style={{ gap: '28px' }}>
            <div className="flex flex-col" style={{ gap: '12px' }}>
              <span className="flex items-center gap-3" style={{ ...label, color: GOLD }}>
                {CATEGORY_LABEL[product.category]}
                <span style={{ width: '26px', height: '1px', background: GOLD_FADE }} />
              </span>

              <h1
                style={{
                  fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
                  fontSize: 'clamp(32px, 4vw, 46px)',
                  fontWeight: 300,
                  lineHeight: 1.1,
                  letterSpacing: '0.01em',
                  color: INK,
                  textWrap: 'balance',
                }}
              >
                {product.name}
              </h1>

              <span style={{ ...body, fontSize: '21px', letterSpacing: '0.06em', fontWeight: 500, color: ACCENT }}>
                {product.price}
              </span>
            </div>

            <p style={{ ...body, fontSize: '14px', fontWeight: 300, lineHeight: 1.85, color: MUTED, maxWidth: '44ch' }}>
              {product.description}
            </p>

            <div className="flex flex-col" style={{ gap: '12px' }}>
              <div className="flex flex-wrap" style={{ gap: '11px' }}>
                <button
                  onClick={addToBag}
                  className="cursor-pointer"
                  style={{
                    ...label,
                    fontSize: '11px', letterSpacing: '0.22em',
                    padding: '16px 38px',
                    background: justAdded ? 'var(--sage-ink)' : INK,
                    color: '#ffffff',
                    border: 'none',
                    transition: 'background 0.25s',
                  }}
                >
                  {justAdded ? 'Added ✓' : canAddToCart ? 'Add to Bag' : 'Sign In to Buy'}
                </button>

                {/* Only pieces with a calibrated 3D model can be tried on. */}
                {product.arEnabled && (
                  <button
                    onClick={() => onTryOn(product)}
                    className="cursor-pointer inline-flex items-center gap-2.5"
                    style={{
                      ...label,
                      fontSize: '11px', letterSpacing: '0.22em',
                      padding: '15px 32px',
                      background: 'transparent',
                      color: GOLD_DEEP,
                      border: `1px solid ${GOLD_FADE}`,
                      transition: 'all 0.25s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = GOLD; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = GOLD; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = GOLD_DEEP; e.currentTarget.style.borderColor = GOLD_FADE; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="6" width="18" height="13" rx="2.5" />
                      <circle cx="12" cy="12.5" r="3.4" />
                    </svg>
                    Try On Live
                  </button>
                )}
              </div>

              {!product.arEnabled && (
                <span style={{ ...body, fontSize: '12px', fontWeight: 300, color: MUTED, opacity: 0.75 }}>
                  Live try-on isn&rsquo;t available for this piece yet.
                </span>
              )}
            </div>

            <div className="flex flex-col" style={{ gap: '12px', paddingTop: '26px', borderTop: `1px solid ${LINE}` }}>
              {[
                'Made to order in Nepal',
                'Delivery in 5–7 business days',
                'Free delivery over Rs 2,000',
              ].map((line) => (
                <span key={line} className="flex items-center gap-3" style={{ ...body, fontSize: '13px', fontWeight: 300, color: MUTED }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill={GOLD} style={{ flexShrink: 0 }}>
                    <path d="M12 0c.7 6.4 5.1 11 12 12-6.9 1-11.3 5.6-12 12-.7-6.4-5.1-11-12-12 6.9-1 11.3-5.6 12-12z" />
                  </svg>
                  {line}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </Band>

      {/* Suggestions stay inside the category being viewed — someone looking at
          earrings wants other earrings, not a bracelet. */}
      {related.length > 0 && (
        <Band background="#ffffff" borderTop padY="clamp(44px, 6vw, 76px)">
          <div className="flex flex-col" style={{ gap: 'clamp(28px, 4vw, 44px)' }}>
            <div className="flex items-center gap-5">
              <h2
                style={{
                  fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
                  fontSize: 'clamp(23px, 2.8vw, 30px)',
                  fontWeight: 300,
                  letterSpacing: '0.02em',
                  color: INK,
                  whiteSpace: 'nowrap',
                }}
              >
                More {CATEGORY_LABEL[product.category]}
              </h2>
              <span style={{ flex: 1, height: '1px', background: LINE }} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 'clamp(18px, 2.5vw, 30px)' }}>
              {related.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item)}
                  className="group flex flex-col text-left cursor-pointer"
                  style={{ background: 'none', border: 'none', padding: 0, gap: '13px' }}
                >
                  <span
                    className="relative w-full aspect-square overflow-hidden block transition-colors duration-300"
                    style={{ background: '#f6f5f3', border: `1px solid ${LINE}` }}
                  >
                    <ProductImage
                      product={item}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-[0.22,1,0.36,1] group-hover:scale-[1.07]"
                    />
                  </span>

                  <span className="flex flex-col" style={{ gap: '4px' }}>
                    <span
                      className="line-clamp-2"
                      style={{ ...body, fontSize: '14px', color: INK, lineHeight: 1.3, minHeight: '2.6em' }}
                    >
                      {item.name}
                    </span>
                    <span style={{ ...body, fontSize: '13px', letterSpacing: '0.06em', fontWeight: 500, color: ACCENT }}>
                      {item.price}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Band>
      )}
    </section>
  );
}
