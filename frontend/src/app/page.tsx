'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { PRODUCTS, Product } from '@/data/products';
import ARView from '@/components/ARView';
import OrderModal from '@/components/OrderModal';
import ModelViewer from '@/components/ModelViewer';

type Tab = 'home' | 'jewelry' | 'about';

/* ─── Arrow SVG ─── */
const ArrowRight = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size * 0.55} viewBox="0 0 13.6 7.5" fill="currentColor">
    <polygon points="9.9 0 9.4 .5 12.3 3.4 .7 3.4 .7 .2 0 .2 0 4.1 12.3 4.1 9.4 7 9.9 7.5 13.6 3.8 9.9 0" />
  </svg>
);

/* ─── Four-point star glyph ─── */
const Star = ({ size = 10, color = 'var(--gold)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M12 0c.7 6.4 5.1 11 12 12-6.9 1-11.3 5.6-12 12-.7-6.4-5.1-11-12-12 6.9-1 11.3-5.6 12-12z" />
  </svg>
);

/* ─── Corner marks decoration ─── */
const CornerMarks = ({ color = 'rgba(255,255,255,0.18)' }: { color?: string }) => (
  <>
    <div className="absolute top-3 left-3 w-5 h-5 pointer-events-none" style={{ borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` }} />
    <div className="absolute top-3 right-3 w-5 h-5 pointer-events-none" style={{ borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` }} />
    <div className="absolute bottom-3 left-3 w-5 h-5 pointer-events-none" style={{ borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` }} />
    <div className="absolute bottom-3 right-3 w-5 h-5 pointer-events-none" style={{ borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` }} />
  </>
);

/* ─── Scroll-animation hook using IntersectionObserver ─── */
function useScrollAnimation() {
  const observe = useCallback(() => {
    const elements = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return observer;
  }, []);

  return observe;
}

const COLLECTIONS = [
  {
    id: 'earrings',
    label: 'From $650',
    title: 'Earrings',
    about: 'The first thing anyone notices. Faceted rubies and tanzanite teardrops ringed in pavé diamonds, and mirror-polished hoops in solid gold — every pair made to order in 18k or 24k.',
    modelPath: '/models/earrings/astraea_diamond_drops.glb',
    image: '/images/earrings1.png',
    available: true,
  },
  {
    id: 'necklaces',
    label: 'From $1,150',
    title: 'Necklaces',
    about: 'Statement collars hand-carved in solid 22k yellow gold, hand-knotted pearl strands, and lockets on fine chains — weighted to rest exactly where they should.',
    modelPath: '/models/necklaces/pleiades_pearl_strand.glb',
    image: '/images/necklace1.png',
    available: true,
  },
  {
    id: 'rings',
    label: 'From $1,600',
    title: 'Rings',
    about: 'Solitaires and pavé bands, made to measure for your hand — each one cast as a single piece and signed in gold.',
    modelPath: '/models/rings/rosanna_pave_band.glb',
    image: '/images/ring1.png',
    available: true,
  },
  {
    id: 'bracelets',
    label: 'From $980',
    title: 'Bracelets',
    about: 'Chain and woven bracelets in solid gold, sized to your wrist and finished with a hand-polished clasp.',
    modelPath: '/models/bracelets/callisto_chain.glb',
    image: '/images/bracelet1.png',
    available: true,
  },
] as const;

export default function Home() {
  /* ── URL hash-based tab persistence ── */
  const [activeTab, setActiveTab] = useState<Tab>('home');

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'jewelry' || hash === 'about' || hash === 'home' || hash === '') {
        setActiveTab(hash === '' ? 'home' : (hash as Tab));
      }
    };
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, []);

  const goToTab = (tab: Tab) => {
    setActiveTab(tab);
    window.location.hash = tab === 'home' ? '' : tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Scroll animations ── */
  const observe = useScrollAnimation();
  useEffect(() => {
    const observer = observe();
    return () => observer.disconnect();
  }, [activeTab, observe]);

  /* ── Other state ── */
  const [activeArProduct, setActiveArProduct] = useState<Product | null>(null);
  const [orderData, setOrderData] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | Product['category']>('all');
  const [collectionIndex, setCollectionIndex] = useState(0);
  const activeCollection = COLLECTIONS[collectionIndex];

  const filteredProducts = PRODUCTS.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      className="min-h-screen w-full flex flex-col overflow-x-hidden"
      style={{ background: 'var(--black)', color: 'var(--white)', fontFamily: "var(--font-space), 'Space Grotesk', sans-serif" }}
    >

      {/* ══════════════════════════════════════
          NAVIGATION — always black
      ══════════════════════════════════════ */}
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          background: 'rgba(10,10,10,0.96)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-12 py-5 flex items-center justify-between relative">

          {/* Left — desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {(['home', 'jewelry', 'about'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => goToTab(tab)}
                  className="underline-slide cursor-pointer"
                  style={{
                    background: 'none', border: 'none',
                    fontSize: '10px', letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--white)' : 'var(--white-fade)',
                    transition: 'color 0.25s',
                    padding: '4px 0',
                    fontFamily: "var(--font-space), sans-serif",
                  }}
                >
                  {tab === 'about' ? 'About Us' : tab}
                </button>
              );
            })}
          </nav>

          {/* Center — Logo */}
          <button
            onClick={() => goToTab('home')}
            className="cursor-pointer absolute left-1/2 -translate-x-1/2"
            style={{
              background: 'none', border: 'none',
              fontSize: '20px', letterSpacing: '0.35em',
              fontWeight: 300, color: 'var(--white)',
              fontFamily: "var(--font-space), sans-serif",
              textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}
          >
            <span className="flex items-center gap-1.5">
              STELLA<Star size={8} />LENS
            </span>
          </button>

          {/* Right — icons */}
          <div className="flex items-center gap-5 ml-auto">
            <button
              className="cursor-pointer"
              style={{ background: 'none', border: 'none', color: 'var(--white-fade)', lineHeight: 0 }}
              title="Search"
            >
              <svg width="15" height="15" viewBox="0 0 94 94" fill="currentColor">
                <path d="M94,89.8L79,74.8c6.9-7.9,11.1-18.3,11.1-29.6C90.1,20.2,69.8,0,44.9,0S-0.2,20.2-0.2,45.2s20.3,45.2,45.1,45.2c11.4,0,21.7-4.2,29.7-11.2l15,15,4.4-4.4ZM44.9,84.2c-21.5,0-39-17.5-39-39s17.5-39,39-39,39,17.5,39,39-17.5,39-39,39Z" />
              </svg>
            </button>
            <button
              className="cursor-pointer relative"
              style={{ background: 'none', border: 'none', color: 'var(--white-fade)', lineHeight: 0 }}
              title="Cart"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {orderData && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: 'var(--gold)' }} />
              )}
            </button>
            {/* Mobile hamburger */}
            <div className="flex md:hidden flex-col gap-1.5 cursor-pointer" style={{ lineHeight: 0 }}>
              <span className="block w-5 h-px" style={{ background: 'var(--white)' }} />
              <span className="block w-3 h-px" style={{ background: 'var(--white)' }} />
            </div>
          </div>
        </div>

        {/* Mobile nav row */}
        <div className="md:hidden flex justify-center gap-8 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {(['home', 'jewelry', 'about'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => goToTab(tab)}
                className="cursor-pointer"
                style={{
                  background: 'none', border: 'none',
                  borderBottom: isActive ? '1px solid var(--white)' : '1px solid transparent',
                  fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--white)' : 'var(--white-fade)',
                  fontFamily: "var(--font-space), sans-serif",
                  paddingBottom: '2px',
                }}
              >
                {tab === 'about' ? 'About' : tab}
              </button>
            );
          })}
        </div>
      </header>


      {/* ══════════════════════════════════════
          MAIN
      ══════════════════════════════════════ */}
      <main className="flex-1 w-full">

        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <>
            {/* ── SECTION 1: HERO — BLACK ── */}
            <section
              className="relative w-full flex flex-col items-center justify-center text-center overflow-hidden"
              style={{
                minHeight: '90vh',
                background: 'radial-gradient(ellipse at 50% 130%, #141b33 0%, var(--black) 62%)',
                padding: '100px 24px 120px',
              }}
            >
              {/* Starfield */}
              <div className="night-stars" />

              {/* Gold nebula glow */}
              <div className="absolute pointer-events-none" style={{
                top: '38%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: '760px', height: '760px',
                background: 'radial-gradient(circle, rgba(201,168,112,0.09) 0%, transparent 65%)',
                borderRadius: '50%',
              }} />

              <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-7">
                <span className="label-tag flex items-center gap-2" data-animate data-animate-delay="1">
                  <Star size={9} /> The MoonStella Atelier
                </span>

                <h1
                  className="font-editorial"
                  data-animate
                  data-animate-delay="2"
                  style={{
                    fontSize: 'clamp(50px, 9vw, 96px)',
                    fontWeight: 300,
                    lineHeight: 1.06,
                    letterSpacing: '0.02em',
                    color: 'var(--white)',
                  }}
                >
                  <span style={{ fontStyle: 'italic' }}>Written in the stars.</span><br />
                  <span style={{ fontWeight: 600, letterSpacing: '0.06em' }}>
                    Worn in seconds.
                  </span>
                </h1>

                <p
                  data-animate
                  data-animate-delay="3"
                  style={{
                    fontSize: '14px', fontWeight: 300,
                    color: 'var(--white-fade)',
                    letterSpacing: '0.04em', lineHeight: 1.85,
                    maxWidth: '480px',
                  }}
                >
                  Every StellaLens piece is named for the night sky and made to order in solid gold.
                  Open your camera, see it on you — live — then choose your stones and commission it.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 mt-2" data-animate data-animate-delay="4">
                  <button className="btn-fill-solid" onClick={() => goToTab('jewelry')}>
                    Explore the Collection
                    <ArrowRight />
                  </button>
                  <button
                    className="btn-fill"
                    onClick={() => {
                      const ast = PRODUCTS.find(p => p.id === 'earring_diamond');
                      if (ast) setActiveArProduct(ast);
                    }}
                  >
                    Try On Live
                  </button>
                </div>
              </div>

              {/* Scroll line */}
              <div
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                data-animate="fade"
                data-animate-delay="5"
                style={{ opacity: 0 }}
              >
                <span className="label-white" style={{ fontSize: '8px' }}>Scroll</span>
                <div style={{
                  width: '1px', height: '50px',
                  background: 'linear-gradient(to bottom, var(--gold-fade), transparent)',
                }} />
              </div>
            </section>

            {/* ── SECTION 2: SHOP BY COLLECTION — CREAM ── */}
            <section style={{ background: 'var(--cream)', color: 'var(--cream-text)' }}>
              <div className="max-w-7xl mx-auto px-6 sm:px-12 py-24 flex flex-col items-center gap-14">

                {/* Header */}
                <div className="flex flex-col items-center text-center gap-3" data-animate>
                  <span className="label-tag flex items-center gap-2 justify-center">
                    <Star size={9} /> The Collections
                  </span>
                  <h2
                    className="font-editorial"
                    style={{
                      fontSize: 'clamp(36px, 5vw, 58px)',
                      fontWeight: 300, letterSpacing: '0.03em',
                      color: 'var(--cream-text)',
                    }}
                  >
                    Named for the night sky
                  </h2>
                  <p style={{
                    fontSize: '13px', fontWeight: 300,
                    color: 'var(--cream-muted)', lineHeight: 1.8, maxWidth: '440px',
                  }}>
                    Explore each collection in three dimensions — drag the piece to turn it.
                  </p>
                </div>

                {/* Collection coverflow slider */}
                <div className="w-full flex flex-col items-center gap-10" data-animate>

                  {/* Stage */}
                  <div
                    className="relative w-full overflow-hidden"
                    style={{
                      background: 'radial-gradient(ellipse at 50% 130%, #141b33 0%, var(--black) 65%)',
                      border: '1px solid var(--cream-border)',
                      height: 'min(110vw, 520px)',
                    }}
                  >
                    <div className="night-stars" />

                    {COLLECTIONS.map((col, i) => {
                      const n = COLLECTIONS.length;
                      let off = (i - collectionIndex + n) % n;
                      if (off > n / 2) off -= n; // shortest wrap: -1, 0, 1, (2 = hidden behind)
                      const isCenter = off === 0;
                      const hidden = Math.abs(off) > 1;
                      return (
                        <div
                          key={col.id}
                          className="absolute top-1/2 left-1/2 overflow-hidden"
                          style={{
                            width: 'min(62%, 330px)', aspectRatio: '3/4',
                            transform: `translate(-50%, -50%) translateX(${off * 72}%) scale(${isCenter ? 1 : 0.76})`,
                            transition: 'transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s, border-color 0.45s',
                            opacity: hidden ? 0 : isCenter ? 1 : 0.45,
                            zIndex: isCenter ? 3 : hidden ? 0 : 1,
                            pointerEvents: hidden ? 'none' : 'auto',
                            background: 'linear-gradient(180deg, rgba(20,27,51,0.9) 0%, rgba(10,13,23,0.95) 100%)',
                            border: isCenter ? '1px solid rgba(201,168,112,0.4)' : '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          {!hidden && (
                            <div className="absolute inset-0">
                              <ModelViewer modelPath={col.modelPath} fallbackImage={col.image} />
                            </div>
                          )}
                          {/* Card caption */}
                          <div
                            className="absolute bottom-0 inset-x-0 flex flex-col items-center gap-1 pointer-events-none"
                            style={{
                              padding: '28px 12px 16px',
                              background: 'linear-gradient(to top, rgba(10,13,23,0.85), transparent)',
                            }}
                          >
                            <span
                              className="font-editorial"
                              style={{ fontSize: '20px', fontWeight: 300, letterSpacing: '0.05em', color: 'var(--white)' }}
                            >
                              {col.title}
                            </span>
                            <span
                              style={{
                                fontSize: '8px', letterSpacing: '0.25em', textTransform: 'uppercase',
                                color: 'var(--gold)', fontFamily: "var(--font-space), sans-serif",
                              }}
                            >
                              {col.label}
                            </span>
                          </div>
                          {/* Side cards: click to focus */}
                          {!isCenter && !hidden && (
                            <button
                              aria-label={`Show ${col.title}`}
                              className="absolute inset-0 cursor-pointer"
                              style={{ background: 'transparent', border: 'none', zIndex: 2 }}
                              onClick={() => setCollectionIndex(i)}
                            />
                          )}
                        </div>
                      );
                    })}

                    {/* Arrows */}
                    <button
                      aria-label="Previous collection"
                      className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer flex items-center justify-center"
                      style={{
                        zIndex: 4, width: '40px', height: '40px',
                        background: 'rgba(10,13,23,0.6)', backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'var(--white)', transition: 'border-color 0.25s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
                      onClick={() => setCollectionIndex(i => (i - 1 + COLLECTIONS.length) % COLLECTIONS.length)}
                    >
                      <span style={{ transform: 'scaleX(-1)', display: 'inline-flex' }}><ArrowRight size={12} /></span>
                    </button>
                    <button
                      aria-label="Next collection"
                      className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer flex items-center justify-center"
                      style={{
                        zIndex: 4, width: '40px', height: '40px',
                        background: 'rgba(10,13,23,0.6)', backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'var(--white)', transition: 'border-color 0.25s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
                      onClick={() => setCollectionIndex(i => (i + 1) % COLLECTIONS.length)}
                    >
                      <ArrowRight size={12} />
                    </button>

                    {/* Drag hint */}
                    <span
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
                      style={{
                        zIndex: 4,
                        fontSize: '8px', letterSpacing: '0.25em', textTransform: 'uppercase',
                        color: 'var(--white-fade)',
                        fontFamily: "var(--font-space), sans-serif",
                      }}
                    >
                      Drag to rotate
                    </span>
                  </div>

                  {/* Active collection text */}
                  <div
                    key={activeCollection.id}
                    className="slide-fade flex flex-col items-center text-center gap-4 max-w-xl"
                  >
                    <span
                      style={{
                        fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
                        color: 'var(--gold)',
                        fontFamily: "var(--font-space), sans-serif", fontWeight: 500,
                      }}
                    >
                      {activeCollection.label}
                    </span>
                    <h3
                      className="font-editorial"
                      style={{
                        fontSize: 'clamp(34px, 4.5vw, 50px)', fontWeight: 300,
                        letterSpacing: '0.03em', color: 'var(--cream-text)', lineHeight: 1.05,
                      }}
                    >
                      {activeCollection.title}
                    </h3>
                    <p style={{
                      fontSize: '13px', color: 'var(--cream-muted)',
                      fontWeight: 300, lineHeight: 1.85, maxWidth: '440px',
                    }}>
                      {activeCollection.about}
                    </p>
                    <button
                      className="btn-fill-cream-solid"
                      style={{ marginTop: '4px' }}
                      onClick={() => goToTab('jewelry')}
                    >
                      View Collection
                      <ArrowRight />
                    </button>
                  </div>

                  {/* Category tabs */}
                  <div className="flex flex-wrap justify-center gap-8">
                    {COLLECTIONS.map((c, i) => (
                      <button
                        key={c.id}
                        onClick={() => setCollectionIndex(i)}
                        className="underline-slide cursor-pointer"
                        style={{
                          background: 'none', border: 'none', padding: '2px 0',
                          fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase',
                          fontFamily: "var(--font-space), sans-serif",
                          fontWeight: i === collectionIndex ? 600 : 400,
                          color: i === collectionIndex ? 'var(--cream-text)' : 'var(--cream-muted)',
                          borderBottom: i === collectionIndex ? '1px solid var(--gold)' : '1px solid transparent',
                          transition: 'color 0.25s',
                        }}
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── SECTION 3: TRENDING SPOTLIGHT — BLACK ── */}
            <section style={{ background: 'var(--black)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="max-w-7xl mx-auto px-6 sm:px-12 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

                {/* Text side */}
                <div className="flex flex-col items-center text-center gap-6" data-animate>
                  <span className="label-tag flex items-center gap-2">
                    <Star size={9} /> This Season
                  </span>
                  <h2
                    className="font-editorial"
                    style={{
                      fontSize: 'clamp(40px, 5vw, 66px)',
                      fontWeight: 300, letterSpacing: '0.03em',
                      color: 'var(--white)', lineHeight: 1.1,
                    }}
                  >
                    Astraea<br />
                    <span style={{ fontStyle: 'italic' }}>Diamond Drops</span>
                  </h2>
                  <p style={{
                    fontSize: '13px', fontWeight: 300,
                    color: 'var(--white-fade)', lineHeight: 1.85, maxWidth: '400px',
                  }}>
                    A brilliant-cut ruby above a tanzanite teardrop, ringed in pavé diamonds
                    and set in 24k gold. Named for the goddess who became a constellation.
                    Made to order — $1,250.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      className="btn-fill-solid"
                      onClick={() => {
                        const ast = PRODUCTS.find(p => p.id === 'earring_diamond');
                        if (ast) setActiveArProduct(ast);
                      }}
                    >
                      Try On Live
                    </button>
                    <button className="btn-fill" onClick={() => goToTab('jewelry')}>
                      All Pieces
                    </button>
                  </div>
                </div>

                {/* Image */}
                <div className="relative w-full" data-animate="scale" style={{ maxWidth: '480px', margin: '0 auto' }}>
                  <div
                    className="relative w-full overflow-hidden"
                    style={{
                      aspectRatio: '1/1',
                      border: '1px solid rgba(201,168,112,0.28)',
                    }}
                  >
                    <img
                      src="/images/earrings1.png"
                      alt="Astraea Diamond Drops — ruby and tanzanite earrings in 24k gold"
                      className="w-full h-full object-cover product-img"
                    />
                  </div>
                  {/* Star accents */}
                  <div className="absolute pointer-events-none" style={{ top: '-9px', right: '-9px' }}>
                    <Star size={18} color="var(--gold)" />
                  </div>
                  <div className="absolute pointer-events-none" style={{ bottom: '18px', left: '-11px' }}>
                    <Star size={11} color="var(--gold-fade)" />
                  </div>
                </div>
              </div>
            </section>

            {/* ── SECTION 4: HOW IT WORKS — CREAM ── */}
            <section style={{ background: 'var(--cream)', color: 'var(--cream-text)' }}>
              <div className="max-w-7xl mx-auto px-6 sm:px-12 py-24 flex flex-col items-center text-center gap-12">
                <div className="flex flex-col items-center gap-3" data-animate>
                  <span className="label-tag flex items-center gap-2 justify-center">
                    <Star size={9} /> How It Works
                  </span>
                  <h2
                    className="font-editorial"
                    style={{
                      fontSize: 'clamp(34px, 5vw, 58px)',
                      fontWeight: 300, letterSpacing: '0.03em',
                      color: 'var(--cream-text)', maxWidth: '680px', lineHeight: 1.15,
                    }}
                  >
                    The fitting room<br /><span style={{ fontStyle: 'italic' }}>is your camera.</span>
                  </h2>
                  <p style={{
                    fontSize: '13px', fontWeight: 300,
                    color: 'var(--cream-muted)', lineHeight: 1.85, maxWidth: '480px',
                  }}>
                    No appointment, no counter glass. StellaLens follows your features in real
                    time, so each piece sits where it would really sit — and moves the way real
                    jewellery moves.
                  </p>
                </div>

                {/* Steps */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-3 w-full max-w-3xl"
                  data-animate
                  style={{
                    borderTop: '1px solid var(--cream-border)',
                    paddingTop: '40px',
                    gap: '32px',
                  }}
                >
                  {[
                    { num: '01', title: 'Choose a piece', text: 'Browse the atelier and pick what catches your eye.' },
                    { num: '02', title: 'Open your camera', text: 'See it on your ears or neck — live, moving with you.' },
                    { num: '03', title: 'Make it yours', text: 'Choose your stones, set the size, and commission it.' },
                  ].map(({ num, title, text }) => (
                    <div key={num} className="flex flex-col items-center gap-3 px-2">
                      <span
                        className="font-editorial"
                        style={{ fontSize: '30px', fontWeight: 300, fontStyle: 'italic', color: 'var(--gold)', letterSpacing: '0.05em' }}
                      >
                        {num}
                      </span>
                      <span style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--cream-text)', fontWeight: 500 }}>
                        {title}
                      </span>
                      <p style={{ fontSize: '12px', fontWeight: 300, color: 'var(--cream-muted)', lineHeight: 1.75 }}>
                        {text}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  className="btn-fill-cream-solid"
                  data-animate
                  onClick={() => {
                    const ast = PRODUCTS.find(p => p.id === 'earring_diamond');
                    if (ast) setActiveArProduct(ast);
                  }}
                >
                  Start a Try-On
                  <ArrowRight />
                </button>
              </div>
            </section>
          </>
        )}

        {/* ==================== JEWELRY CATALOG TAB ==================== */}
        {activeTab === 'jewelry' && (
          <section style={{ background: 'var(--black)', minHeight: '100vh' }}>
            <div className="max-w-7xl mx-auto px-6 sm:px-12 py-16 space-y-10">

              {/* Header */}
              <div
                className="flex flex-col items-center text-center gap-3 pb-8 mx-auto w-full"
                data-animate
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="label-tag">The Atelier Collection</span>
                <h2
                  className="font-editorial"
                  style={{
                    fontSize: 'clamp(36px, 5vw, 60px)',
                    fontWeight: 300, letterSpacing: '0.03em', color: 'var(--white)',
                  }}
                >
                  Fine Jewelry Catalog
                </h2>
              </div>

              {/* Search & Filter */}
              <div
                className="flex flex-col sm:flex-row gap-6 items-start sm:items-end justify-between"
                data-animate
              >
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <svg
                    className="absolute left-0 top-1/2 -translate-y-1/2"
                    width="12" height="12" viewBox="0 0 94 94" fill="rgba(255,255,255,0.3)"
                  >
                    <path d="M94,89.8L79,74.8c6.9-7.9,11.1-18.3,11.1-29.6C90.1,20.2,69.8,0,44.9,0S-0.2,20.2-0.2,45.2s20.3,45.2,45.1,45.2c11.4,0,21.7-4.2,29.7-11.2l15,15,4.4-4.4ZM44.9,84.2c-21.5,0-39-17.5-39-39s17.5-39,39-39,39,17.5,39,39-17.5,39-39,39Z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search collection..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-dark"
                    style={{ paddingLeft: '22px' }}
                  />
                </div>

                {/* Filter pills */}
                <div className="flex flex-wrap gap-2">
                  {(['all', 'earrings', 'necklaces', 'rings', 'bracelets'] as const).map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className="cursor-pointer"
                        style={{
                          position: 'relative', overflow: 'hidden',
                          background: active ? 'var(--white)' : 'transparent',
                          color: active ? 'var(--black)' : 'var(--white-fade)',
                          border: `1px solid ${active ? 'var(--white)' : 'rgba(255,255,255,0.2)'}`,
                          borderRadius: 0,
                          fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase',
                          fontFamily: "var(--font-space), sans-serif",
                          fontWeight: active ? 600 : 400,
                          padding: '9px 20px',
                          transition: 'all 0.3s',
                        }}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Product Grid */}
              {filteredProducts.length === 0 ? (
                <div className="text-center py-24" style={{ color: 'var(--white-fade)', fontSize: '13px', fontWeight: 300, letterSpacing: '0.1em' }}>
                  No results found.
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                  style={{ gap: '1px', background: 'rgba(255,255,255,0.06)' }}
                >
                  {filteredProducts.map((product, i) => (
                    <div
                      key={product.id}
                      className="product-card flex flex-col"
                      data-animate
                      data-animate-delay={String(Math.min(i + 1, 4)) as any}
                      style={{ background: 'var(--black-card)' }}
                    >
                      {/* Live 3D model */}
                      <div
                        className="relative overflow-hidden"
                        style={{
                          aspectRatio: '1/1',
                          background: 'radial-gradient(ellipse at 50% 130%, #141b33 0%, var(--black-soft) 70%)',
                        }}
                      >
                        <div className="night-stars" style={{ opacity: 0.5 }} />
                        <div className="absolute inset-0">
                          <ModelViewer modelPath={product.modelPath} fallbackImage={product.image} />
                        </div>
                        {product.arEnabled && (
                          <div
                            className="absolute top-4 left-4"
                            style={{
                              background: 'var(--gold)', color: 'var(--gold-ink)',
                              fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase',
                              padding: '5px 10px',
                              fontFamily: "var(--font-space), sans-serif", fontWeight: 600,
                            }}
                          >
                            Try On
                          </div>
                        )}
                        <CornerMarks color="rgba(255,255,255,0.1)" />
                      </div>

                      {/* Info */}
                      <div
                        className="flex flex-col gap-4 p-6 flex-1 items-center text-center"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        <div className="w-full">
                          <span style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--white-fade)' }}>
                            {product.category}
                          </span>
                          <h3
                            className="font-editorial"
                            style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '0.03em', color: 'var(--white)', marginTop: '4px', lineHeight: 1.2 }}
                          >
                            {product.name}
                          </h3>
                          <div
                            className="flex items-center justify-center mt-3"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}
                          >
                            <span style={{ fontSize: '15px', fontWeight: 400, color: 'var(--white)', letterSpacing: '0.05em' }}>
                              {product.price}
                            </span>
                          </div>
                        </div>
                        <p style={{
                          fontSize: '11px', fontWeight: 300,
                          color: 'var(--white-fade)', lineHeight: 1.7,
                          overflow: 'hidden', display: '-webkit-box',
                          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        } as React.CSSProperties}>
                          {product.description}
                        </p>
                        {product.arEnabled ? (
                          <button
                            className="btn-fill w-full"
                            style={{ width: '100%', marginTop: '4px' }}
                            onClick={() => setActiveArProduct(product)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Try On Live
                          </button>
                        ) : (
                          <div
                            className="w-full flex items-center justify-center"
                            style={{
                              marginTop: '4px', padding: '14px 32px',
                              border: '1px solid rgba(255,255,255,0.12)',
                              fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase',
                              color: 'var(--white-fade)',
                              fontFamily: "var(--font-space), sans-serif",
                            }}
                          >
                            Try-On Coming Soon
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ==================== ABOUT TAB ==================== */}
        {activeTab === 'about' && (
          <>
            {/* About hero — black */}
            <section style={{ background: 'var(--black)' }}>
              <div
                className="max-w-7xl mx-auto px-6 sm:px-12 py-20 flex flex-col items-center text-center gap-4"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                data-animate
              >
                <span className="label-tag">Our Heritage & Craft</span>
                <h2
                  className="font-editorial"
                  style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 300, letterSpacing: '0.03em', color: 'var(--white)' }}
                >
                  About StellaLens
                </h2>
              </div>
            </section>

            {/* Story 1 — cream */}
            <section style={{ background: 'var(--cream)', color: 'var(--cream-text)' }}>
              <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div className="flex flex-col gap-6" data-animate>
                  <h3
                    className="font-editorial"
                    style={{ fontSize: '36px', fontWeight: 300, color: 'var(--cream-text)', letterSpacing: '0.02em', fontStyle: 'italic' }}
                  >
                    Heritage meets next-gen fitting
                  </h3>
                  <p style={{ fontSize: '13px', fontWeight: 300, color: 'var(--cream-muted)', lineHeight: 1.9 }}>
                    StellaLens was founded on the vision of bridging ancient jewellery-making traditions with state-of-the-art visual technology. We custom design each piece from raw components, ensuring that every Ruby, Tanzanite, and Diamond halo reflects pure luxury.
                  </p>
                  <p style={{ fontSize: '13px', fontWeight: 300, color: 'var(--cream-muted)', lineHeight: 1.9 }}>
                    Part of the MoonStella Collection, we hold ourselves to the highest standards of materials and craftsmanship — sourcing exclusively ethical stones and conflict-free yellow and white gold.
                  </p>
                  <button
                    className="btn-fill-cream-solid w-fit"
                    onClick={() => goToTab('jewelry')}
                  >
                    Explore Pieces
                    <ArrowRight />
                  </button>
                </div>
                <div
                  className="flex items-center justify-center"
                  data-animate="scale"
                  style={{
                    background: 'var(--cream-dark)', aspectRatio: '4/3',
                    border: '1px solid var(--cream-border)',
                  }}
                >
                  <span
                    className="font-editorial"
                    style={{ fontSize: '12px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--cream-muted)' }}
                  >
                    Crafted in 18K Solid Gold
                  </span>
                </div>
              </div>
            </section>

            {/* Story 2 — black */}
            <section style={{ background: 'var(--black)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                <div
                  className="flex items-center justify-center order-2 lg:order-1"
                  data-animate="scale"
                  style={{
                    background: 'var(--black-card)', aspectRatio: '4/3',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <span
                    className="font-editorial"
                    style={{ fontSize: '12px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--white-fade)' }}
                  >
                    85ms Smoothing Tracker
                  </span>
                </div>
                <div className="flex flex-col gap-6 order-1 lg:order-2" data-animate>
                  <h3
                    className="font-editorial"
                    style={{ fontSize: '36px', fontWeight: 300, color: 'var(--white)', letterSpacing: '0.02em', fontStyle: 'italic' }}
                  >
                    Virtual fitting. Flawless simulation.
                  </h3>
                  <p style={{ fontSize: '13px', fontWeight: 300, color: 'var(--white-fade)', lineHeight: 1.9 }}>
                    Our virtual try-on module utilises high-performance computer vision. By tracking landmarks on the cheek, jawline, and chin corner, we calculate the face's exact depth coordinates and scale factors.
                  </p>
                  <p style={{ fontSize: '13px', fontWeight: 300, color: 'var(--white-fade)', lineHeight: 1.9 }}>
                    With integrated velocity lookahead projection and harmonic oscillation swing simulation, the jewellery reacts dynamically to your movements under simulated gravitational fields.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </main>


      {/* ══════════════════════════════════════
          FOOTER — black
      ══════════════════════════════════════ */}
      <footer
        className="w-full py-14 flex flex-col items-center gap-5 text-center"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'var(--black)' }}
      >
        <span
          className="flex items-center gap-2"
          style={{
            fontSize: '20px', letterSpacing: '0.4em',
            textTransform: 'uppercase', fontWeight: 300,
            color: 'var(--white)', fontFamily: "var(--font-space), sans-serif",
          }}
        >
          STELLA<Star size={9} />LENS
        </span>
        <span className="label-white" style={{ fontSize: '9px' }}>Named for the night sky · Made to order</span>
        <div className="flex items-center gap-3">
          <div style={{ width: '40px', height: '1px', background: 'rgba(201,168,112,0.3)' }} />
          <Star size={7} color="var(--gold-fade)" />
          <div style={{ width: '40px', height: '1px', background: 'rgba(201,168,112,0.3)' }} />
        </div>
        <div className="flex gap-6">
          {(['home', 'jewelry', 'about'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => goToTab(tab)}
              className="underline-slide cursor-pointer"
              style={{
                background: 'none', border: 'none',
                fontSize: '9px', letterSpacing: '0.2em',
                textTransform: 'uppercase', color: 'var(--white-fade)',
                fontFamily: "var(--font-space), sans-serif",
              }}
            >
              {tab === 'about' ? 'About Us' : tab}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.18)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          © 2026 StellaLens. All rights reserved.
        </span>
      </footer>


      {/* AR View */}
      {activeArProduct && (
        <ARView
          product={activeArProduct}
          onClose={() => setActiveArProduct(null)}
          onOpenOrderModal={setOrderData}
        />
      )}

      {/* Order Modal */}
      <OrderModal
        isOpen={orderData !== null}
        onClose={() => setOrderData(null)}
        orderDetails={orderData}
      />
    </div>
  );
}
