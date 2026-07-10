'use client';

import React, { useState } from 'react';
import { Product } from '@/data/products';

interface RedesignProduct {
  id: string;
  name: string;
  category: 'earrings' | 'necklaces' | 'bracelets' | 'rings';
  price: number;
  subtitle: string;
  arEnabled: boolean;
}

const REDESIGN_PRODUCTS: RedesignProduct[] = [
  {
    id: 'aurelia_studs',
    name: 'Aurelia Studs',
    category: 'earrings',
    price: 4200,
    subtitle: '1.5ct Round Brilliant Diamonds',
    arEnabled: true,
  },
  {
    id: 'celestial_cascade',
    name: 'Celestial Cascade',
    category: 'necklaces',
    price: 18500,
    subtitle: 'Pear-cut Diamond Collar',
    arEnabled: true,
  },
  {
    id: 'the_gilded_link',
    name: 'The Gilded Link',
    category: 'bracelets',
    price: 7800,
    subtitle: '18k Yellow Gold & Pave Diamond',
    arEnabled: true,
  },
  {
    id: 'elysian_solitaire',
    name: 'Elysian Solitaire',
    category: 'rings',
    price: 24000,
    subtitle: '3ct Round Brilliant Platinum Setting',
    arEnabled: true,
  },
  {
    id: 'midnight_dew_drop',
    name: 'Midnight Dew Drop',
    category: 'necklaces',
    price: 12400,
    subtitle: 'Ceylon Sapphire & Diamond Pendant',
    arEnabled: true,
  },
  {
    id: 'verdant_drops',
    name: 'Verdant Drops',
    category: 'earrings',
    price: 5600,
    subtitle: 'Colombian Emeralds in 18k Gold',
    arEnabled: true,
  },
  {
    id: 'luna_stack',
    name: 'Luna Stack',
    category: 'rings',
    price: 3900,
    subtitle: 'Interlocking White Gold Bands',
    arEnabled: true,
  },
  {
    id: 'the_atelier_piece',
    name: 'The Atelier Piece',
    category: 'bracelets',
    price: 14500,
    subtitle: 'Custom Designed to Specification',
    arEnabled: false,
  },
];

const CATEGORY_LABELS = {
  earrings: 'HIGH JEWELRY',
  necklaces: 'HERITAGE',
  bracelets: 'COLLECTIONS',
  rings: 'BESPOKE',
};

interface JewelrySectionProps {
  activeTab: 'home' | 'jewelry' | 'about';
  setActiveArProduct: (product: Product | null) => void;
  selectedCategory: 'all' | Product['category'];
  setSelectedCategory: (category: 'all' | Product['category']) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function JewelrySection({
  activeTab,
  setActiveArProduct,
}: JewelrySectionProps) {
  const [selectedCat, setSelectedCat] = useState<'all' | 'earrings' | 'necklaces' | 'bracelets' | 'rings'>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'low-high' | 'high-low'>('featured');
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  if (activeTab !== 'jewelry') return null;

  const filtered = REDESIGN_PRODUCTS.filter((p) => {
    return selectedCat === 'all' || p.category === selectedCat;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'low-high') return a.price - b.price;
    if (sortBy === 'high-low') return b.price - a.price;
    return 0;
  });

  return (
    <section className="w-full flex flex-col items-center justify-center min-h-screen relative z-10" style={{ background: '#f6f5f3' }}>
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-12 py-16 space-y-12">
        <div
          className="flex flex-col items-center text-center gap-3 pb-8 mx-auto w-full"
          data-animate
        >
          <h2
            className="font-editorial text-black"
            style={{
              fontSize: 'clamp(36px, 5vw, 60px)',
              fontWeight: 300,
              letterSpacing: '0.03em',
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            }}
          >
            Fine Jewelry Catalog
          </h2>
        </div>

        <div className="w-full flex justify-between items-center py-4 border-y border-black/10 relative z-30">
          <div className="relative">
            <button
              onClick={() => {
                setIsCatDropdownOpen(!isCatDropdownOpen);
                setIsSortDropdownOpen(false);
              }}
              className="flex items-center gap-2.5 text-[10px] uppercase tracking-[0.25em] text-black hover:text-black/80 transition-colors cursor-pointer"
            >
              Category <span className="text-[#c5a880]">{selectedCat === 'all' ? '(All)' : `(${selectedCat})`}</span>
              <svg className={`w-3 h-3 transition-transform duration-300 ${isCatDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {isCatDropdownOpen && (
              <div className="absolute left-0 mt-3 w-48 bg-white border border-black/10 shadow-2xl z-40 py-2 rounded-none">
                {(['all', 'earrings', 'necklaces', 'bracelets', 'rings'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCat(cat);
                      setIsCatDropdownOpen(false);
                    }}
                    className={`w-full text-left px-5 py-2.5 text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${
                      selectedCat === cat ? 'text-[#c5a880] bg-black/5 font-semibold' : 'text-neutral-600 hover:text-black hover:bg-black/5'
                    }`}
                  >
                    {cat === 'all' ? 'All Pieces' : cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setIsSortDropdownOpen(!isSortDropdownOpen);
                setIsCatDropdownOpen(false);
              }}
              className="flex items-center gap-2.5 text-[10px] uppercase tracking-[0.25em] text-black hover:text-black/80 transition-colors cursor-pointer"
            >
              Sort By <span className="text-[#c5a880]">({sortBy === 'featured' ? 'Featured' : sortBy === 'low-high' ? 'Price: Low to High' : 'Price: High to Low'})</span>
              <svg className={`w-3 h-3 transition-transform duration-300 ${isSortDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {isSortDropdownOpen && (
              <div className="absolute right-0 mt-3 w-56 bg-white border border-black/10 shadow-2xl z-40 py-2 rounded-none">
                {[
                  { value: 'featured', label: 'Featured' },
                  { value: 'low-high', label: 'Price: Low to High' },
                  { value: 'high-low', label: 'Price: High to Low' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortBy(opt.value as any);
                      setIsSortDropdownOpen(false);
                    }}
                    className={`w-full text-left px-5 py-2.5 text-[10px] uppercase tracking-widest transition-colors cursor-pointer ${
                      sortBy === opt.value ? 'text-[#c5a880] bg-black/5 font-semibold' : 'text-neutral-600 hover:text-black hover:bg-black/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16 justify-center justify-items-center relative z-10">
          {sorted.map((product) => (
            <div key={product.id} className="group flex flex-col items-center text-center gap-4 animate-fade-in max-w-[220px] w-full mx-auto">
              <div className="relative w-full aspect-square bg-[#ffffff] border border-black/5 flex items-center justify-center transition-all duration-300 group-hover:border-[#c5a880]/30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)]">
                <div className="absolute top-3 left-3 w-3 h-3 pointer-events-none" style={{ borderTop: '1px solid rgba(197,168,128,0.25)', borderLeft: '1px solid rgba(197,168,128,0.25)' }} />
                <div className="absolute top-3 right-3 w-3 h-3 pointer-events-none" style={{ borderTop: '1px solid rgba(197,168,128,0.25)', borderRight: '1px solid rgba(197,168,128,0.25)' }} />
                <div className="absolute bottom-3 left-3 w-3 h-3 pointer-events-none" style={{ borderBottom: '1px solid rgba(197,168,128,0.25)', borderLeft: '1px solid rgba(197,168,128,0.25)' }} />
                <div className="absolute bottom-3 right-3 w-3 h-3 pointer-events-none" style={{ borderBottom: '1px solid rgba(197,168,128,0.25)', borderRight: '1px solid rgba(197,168,128,0.25)' }} />
                
                <span className="font-editorial text-[#f2f2f2] text-[70px] select-none leading-none group-hover:text-[#c5a880]/10 transition-colors duration-500" style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif" }}>
                  {product.name.charAt(0)}
                </span>
                
                <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-80 transition-all duration-500 transform group-hover:scale-105">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--gold)">
                    <path d="M12 0c.7 6.4 5.1 11 12 12-6.9 1-11.3 5.6-12 12-.7-6.4-5.1-11-12-12 6.9-1 11.3-5.6 12-12z" />
                  </svg>
                </div>
              </div>

              <div className="flex flex-col items-center gap-1 mt-2">
                <h3 
                  className="tracking-wide font-normal"
                  style={{
                    fontFamily: "var(--font-jost), sans-serif",
                    color: '#000000',
                    fontSize: '20px',
                    lineHeight: '1.2',
                    marginTop: '2px',
                    fontWeight: 400,
                  }}
                >
                  {product.name}
                </h3>
                
                <p 
                  className="font-light italic"
                  style={{
                    fontFamily: "var(--font-jost), sans-serif",
                    color: '#767676',
                    fontSize: '13px',
                    marginTop: '2px',
                  }}
                >
                  {product.subtitle}
                </p>
                
                <span 
                  className="tracking-widest font-semibold mt-1.5"
                  style={{
                    fontFamily: "var(--font-jost), sans-serif",
                    color: '#000000',
                    fontSize: '14px',
                  }}
                >
                  ${product.price.toLocaleString()}
                </span>
              </div>

              {product.arEnabled && (
                <button
                  onClick={() => {
                    const mappedProduct: Product = {
                      id: product.id,
                      name: product.name,
                      category: product.category,
                      price: `$${product.price.toLocaleString()}`,
                      description: product.subtitle,
                      modelPath: `/models/${product.category}/${product.id}.glb`,
                      arEnabled: true,
                      image: `/images/${product.category}1.png`,
                    };
                    setActiveArProduct(mappedProduct);
                  }}
                  className="mt-2 cursor-pointer text-[9px] tracking-[0.22em] uppercase text-[#c5a880] hover:text-black border-b border-[#c5a880]/30 hover:border-black transition-all duration-300 pb-0.5"
                >
                  Try On Live
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
