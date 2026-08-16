'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { PRODUCTS, Product } from '@/data/products';
import AuthModal from '@/components/AuthModal';
import CheckoutSection from '@/components/CheckoutSection';
import { useAuth } from '@/context/AuthContext';
import { useCart, Customizations } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import AccountSection from '@/components/AccountSection';
import ModelViewer from '@/components/ModelViewer';
import Navbar from '@/components/Navbar';
import JewelrySection from '@/components/JewelrySection';
import dynamic from 'next/dynamic';

const ARView = dynamic(() => import('@/components/ARView'), { ssr: false });

type Tab = 'home' | 'jewelry' | 'about' | 'checkout' | 'account';

const TABS: Tab[] = ['home', 'jewelry', 'about', 'checkout', 'account'];
type PendingAction =
  | { kind: 'try-on'; product: Product }
  | { kind: 'add'; product: Product; customizations?: Customizations };

const ArrowRight = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size * 0.55} viewBox="0 0 13.6 7.5" fill="currentColor">
    <polygon points="9.9 0 9.4 .5 12.3 3.4 .7 3.4 .7 .2 0 .2 0 4.1 12.3 4.1 9.4 7 9.9 7.5 13.6 3.8 9.9 0" />
  </svg>
);

const Star = ({ size = 10, color = 'var(--gold)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M12 0c.7 6.4 5.1 11 12 12-6.9 1-11.3 5.6-12 12-.7-6.4-5.1-11-12-12 6.9-1 11.3-5.6 12-12z" />
  </svg>
);

const CornerMarks = ({ color = 'rgba(74,64,56,0.18)' }: { color?: string }) => (
  <>
    <div className="absolute top-3 left-3 w-5 h-5 pointer-events-none" style={{ borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` }} />
    <div className="absolute top-3 right-3 w-5 h-5 pointer-events-none" style={{ borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` }} />
    <div className="absolute bottom-3 left-3 w-5 h-5 pointer-events-none" style={{ borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` }} />
    <div className="absolute bottom-3 right-3 w-5 h-5 pointer-events-none" style={{ borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` }} />
  </>
);

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

const CELESTIAL_STARS = [
  { top: '15%', left: '8%', size: '3px', delay: '0.4s' },
  { top: '35%', left: '88%', size: '2px', delay: '1.2s' },
  { top: '55%', left: '15%', size: '4px', delay: '0.8s' },
  { top: '78%', left: '72%', size: '2px', delay: '2.5s' },
  { top: '22%', left: '60%', size: '3px', delay: '1.8s' },
  { top: '65%', left: '82%', size: '3px', delay: '0.2s' },
  { top: '91%', left: '10%', size: '3px', delay: '3.2s' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('home');

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === '') setActiveTab('home');
      else if ((TABS as string[]).includes(hash)) setActiveTab(hash as Tab);
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

  const observe = useScrollAnimation();
  useEffect(() => {
    const observer = observe();
    return () => observer.disconnect();
  }, [activeTab, observe]);

  const [activeArProduct, setActiveArProduct] = useState<Product | null>(null);
  const { add: addToCart, count: cartCount, ready: cartReady } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const requireAccount = useCallback((action: PendingAction): boolean => {
    if (authLoading) return false;
    if (user) return true;
    setPending(action);
    setAuthModalOpen(true);
    return false;
  }, [user, authLoading]);

  const requestTryOn = useCallback((product: Product | null) => {
    if (!product) { setActiveArProduct(null); return; }
    if (!requireAccount({ kind: 'try-on', product })) return;
    setActiveArProduct(product);
  }, [requireAccount]);

  const requestAddToCart = useCallback(
    (product: Product, customizations?: Customizations): boolean => {
      if (!requireAccount({ kind: 'add', product, customizations })) return false;
      const added = addToCart(product.id, customizations ?? {});
      if (added) {
        toast({
          kind: 'success',
          title: 'Added to your bag',
          message: `${product.name} — saved to your account.`,
        });
      }
      return added;
    },
    [requireAccount, addToCart, toast]
  );

  const [resumeAdd, setResumeAdd] =
    useState<{ product: Product; customizations?: Customizations } | null>(null);

  useEffect(() => {
    if (!resumeAdd || !user || !cartReady) return;
    requestAddToCart(resumeAdd.product, resumeAdd.customizations);
    setResumeAdd(null);
  }, [resumeAdd, user, cartReady, requestAddToCart]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | Product['category']>('all');
  const [collectionIndex, setCollectionIndex] = useState(1);

  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (mainRef.current) {
        mainRef.current.style.setProperty('--mouse-x', `${e.clientX}px`);
        mainRef.current.style.setProperty('--mouse-y', `${e.clientY}px`);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleDragEnd = (event: any, info: any) => {
    const threshold = 40;
    if (info.offset.x < -threshold) {
      setCollectionIndex((prev) => (prev + 1) % COLLECTIONS.length);
    } else if (info.offset.x > threshold) {
      setCollectionIndex((prev) => (prev - 1 + COLLECTIONS.length) % COLLECTIONS.length);
    }
  };

  const COLLECTIONS = [
    { id: 'earrings',  subtext: 'Signature Diamonds',    title: 'Earrings',  image: '/images/earrings1.png' },
    { id: 'necklaces', subtext: 'High Jewelry',          title: 'Necklaces', image: '/images/image.png' },
    { id: 'bracelets', subtext: 'Artisan Gold',          title: 'Bracelets', image: '/images/image copy.png' },
    { id: 'rings',     subtext: 'Engagement & Occasion', title: 'Rings',     image: '/images/image copy 2.png' },
  ] as const;

  return (
    <div
      ref={mainRef}
      className="min-h-screen w-full flex flex-col overflow-x-hidden relative"
      style={{ background: 'var(--black)', color: 'var(--header-text)', fontFamily: "var(--font-jost), 'Jost', sans-serif" }}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300 opacity-60 hidden md:block"
        style={{
          background: 'radial-gradient(550px circle at var(--mouse-x, -999px) var(--mouse-y, -999px), rgba(255, 255, 255, 0.42) 0%, transparent 80%)'
        }}
      />

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {CELESTIAL_STARS.map((star, idx) => (
          <div
            key={idx}
            className="celestial-star"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
            }}
          />
        ))}
      </div>
      <Navbar
        activeTab={activeTab}
        goToTab={goToTab}
        onSignInClick={() => { setPending(null); setAuthModalOpen(true); }}
        onCartClick={() => goToTab('checkout')}
        onAccountClick={() => goToTab('account')}
        cartCount={cartCount}
      />

      <main className="flex-1 w-full">
        {activeTab === 'home' && (
          <>
            <section
              className="relative w-full h-screen overflow-hidden flex items-center justify-center"
              style={{ background: 'transparent' }}
            >
              <div className="absolute inset-0 z-0">
                <img
                  src="/images/image copy 3.png"
                  alt="Stella Lens Hero Background"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-[rgba(18,22,43,0.25)]" />
              </div>

              <div className="relative z-10 text-center flex flex-col items-center gap-6 px-6 max-w-2xl mx-auto mt-12">
                <motion.h1
                  className="font-editorial text-white font-light tracking-wide leading-tight"
                  style={{ fontSize: 'clamp(56px, 7.5vw, 92px)' }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  Stella Lens
                </motion.h1>
                <motion.p
                  className="text-xs sm:text-sm font-light text-white/90 tracking-widest max-w-md uppercase leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.2, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  The intersection of timeless craftsmanship and contemporary elegance.
                </motion.p>
                <motion.button
                  onClick={() => goToTab('jewelry')}
                  className="cursor-pointer tracking-widest uppercase font-semibold text-[10px] py-4 px-10 mt-4 hover:opacity-90 transition-opacity duration-300"
                  style={{
                    background: '#000000',
                    color: '#ffffff',
                    border: 'none',
                    letterSpacing: '0.25em',
                  }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                  Explore Collections
                </motion.button>
              </div>

              <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.8 }}
                transition={{ delay: 1.1, duration: 1.0 }}
              >
                <svg
                  width="16"
                  height="10"
                  viewBox="0 0 14 8"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  className="animate-bounce"
                >
                  <path d="M1 1l6 5 6-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </motion.div>
            </section>

            <section
              className="relative overflow-hidden w-full flex flex-col items-center justify-center"
              style={{ background: 'transparent', borderTop: '1px solid rgba(74,64,56,0.05)' }}
            >
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="gradient-glow-1" style={{ top: '20%', left: '10%' }} />
                <div className="gradient-glow-3" style={{ bottom: '10%', right: '10%' }} />
              </div>

              <div className="relative w-full max-w-7xl mx-auto px-6 sm:px-12 pt-20 pb-28 flex flex-col items-center justify-center gap-12 z-10">
                <div className="w-full flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 pb-4 border-b border-black/5">
                  <motion.h2
                    className="font-editorial text-[38px] sm:text-[46px] font-light text-[var(--header-text)] leading-tight text-center sm:text-left"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                  >
                    Explore Our Collection
                  </motion.h2>
                  <motion.button
                    onClick={() => goToTab('jewelry')}
                    className="text-[10px] tracking-widest uppercase font-semibold text-[var(--header-text)] hover:opacity-85 pb-1 border-b border-black cursor-pointer transition-all duration-300"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                  >
                    View All Pieces
                  </motion.button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full mt-2">
                  {COLLECTIONS.map((col, idx) => (
                    <motion.div
                      key={col.id}
                      onClick={() => {
                        setSelectedCategory(col.id as any);
                        goToTab('jewelry');
                      }}
                      className="flex flex-col items-center text-center gap-4 cursor-pointer group"
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.8, delay: idx * 0.12, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div
                        className="relative w-full aspect-[4/5] overflow-hidden rounded-none border border-black/5 bg-neutral-50 transition-all duration-500 group-hover:shadow-[0_24px_50px_rgba(107,11,20,0.06)]"
                        style={{
                          boxShadow: '0 4px 15px rgba(107,11,20,0.015)'
                        }}
                      >
                        <img
                          src={col.image}
                          alt={col.title}
                          className="w-full h-full object-cover transition-transform duration-700 ease-[0.22,1,0.36,1] group-hover:scale-106"
                        />

                        {col.id === 'rings' && (
                          <div className="absolute bottom-4 right-5 text-right leading-tight z-20 pointer-events-none">
                            <p className="text-[9px] tracking-widest uppercase font-semibold text-[#c5a880]">MOST</p>
                            <p className="text-[9px] tracking-widest uppercase font-semibold text-[#c5a880]">POPULAR</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <h3 className="font-editorial text-2xl text-[var(--header-text)] font-light transition-colors duration-300 group-hover:text-[var(--gold)]">
                          {col.title}
                        </h3>
                        <span className="text-[9px] tracking-widest uppercase text-[var(--header-text-fade)] font-semibold">
                          {col.subtext}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            <section
              className="relative w-full overflow-hidden flex flex-col items-center justify-center"
              style={{ background: '#000000', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div
                className="absolute top-0 right-0 w-[450px] h-[450px] rounded-full pointer-events-none z-0"
                style={{
                  background: 'radial-gradient(circle, rgba(255,255,255,0.045) 0%, transparent 70%)',
                  transform: 'translate(20%, -20%)'
                }}
              />

              <div className="relative w-full max-w-7xl mx-auto px-6 sm:px-12 py-28 lg:py-36 z-10">
                <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-[72px]">

                  <motion.div
                    className="w-full lg:w-[46%] flex flex-col items-start text-left gap-5"
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span
                      className="uppercase tracking-[0.3em] text-[9px] font-bold text-[#c5a880] mb-1"
                    >
                      Featured Masterpiece
                    </span>
                    <h2
                      className="font-editorial text-white leading-tight font-medium tracking-wide"
                      style={{ fontSize: 'clamp(36px, 4.5vw, 48px)', fontWeight: 400, lineHeight: 1.15 }}
                    >
                      The Luminous<br />Astraea Earrings
                    </h2>
                    <p
                      className="text-xs sm:text-[13px] font-light leading-relaxed max-w-md"
                      style={{
                        color: 'rgba(255,255,255,0.65)',
                        fontFamily: "var(--font-jost), sans-serif",
                        letterSpacing: '0.03em',
                        lineHeight: '1.75'
                      }}
                    >
                      A breathtaking display of artisan excellence, featuring hand-selected pear-cut blue sapphires and brilliant diamond clusters set in a cascade of 18k white gold. These earrings represent the pinnacle of Stella Lens's design heritage.
                    </p>
                    <button
                      onClick={() => {
                        const prod = PRODUCTS.find(p => p.id === 'earring_diamond');
                        if (prod) requestTryOn(prod);
                      }}
                      className="cursor-pointer uppercase font-semibold text-[10px] tracking-[0.25em] py-3 px-12 mt-3 transition-all duration-300 hover:bg-[#c5a880] hover:text-white"
                      style={{
                        background: '#ffffff',
                        color: '#000000',
                        border: 'none',
                      }}
                    >
                      Inquire
                    </button>
                  </motion.div>

                  <motion.div
                    className="w-full lg:w-[54%] flex justify-center lg:justify-end"
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="relative w-full max-w-[480px]">
                      <div
                        className="absolute -bottom-3 -left-3 w-32 h-32 border-b border-l pointer-events-none z-0"
                        style={{ borderColor: 'rgba(197, 168, 128, 0.35)', borderWidth: '1px' }}
                      />

                      <div className="relative w-full aspect-square overflow-hidden rounded-none border border-white/10 bg-[#060814] shadow-2xl z-10">
                        <img
                          src="/images/earrings1.png"
                          alt="The Luminous Astraea Earrings"
                          className="w-full h-full object-cover hover:scale-103 transition-transform duration-700 ease-out"
                        />
                      </div>
                    </div>
                  </motion.div>

                </div>
              </div>
            </section>

            <section
              className="relative overflow-hidden w-full flex flex-col items-center justify-center"
              style={{ background: '#f5f5f7', borderTop: '1px solid rgba(0,0,0,0.03)' }}
            >
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="gradient-glow-3" style={{ bottom: '-10%', left: '-10%' }} />
              </div>

              <div className="relative w-full max-w-7xl mx-auto px-6 sm:px-12 py-24 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center z-10">
                <motion.div
                  className="col-span-1 lg:col-span-6 flex flex-col items-start text-left gap-6 lg:pr-8"
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="border border-[#c5a880] px-3.5 py-1 w-fit rounded-[4px] mb-1">
                    <span className="uppercase tracking-[0.25em] text-[9px] font-bold text-[#c5a880]">
                      Stella Tech
                    </span>
                  </div>

                  <h2
                    className="font-editorial text-[var(--header-text)] leading-tight font-bold tracking-wide"
                    style={{ fontSize: 'clamp(36px, 4.5vw, 48px)', fontWeight: 700, lineHeight: 1.15 }}
                  >
                    The Lens Visualization
                  </h2>

                  <p
                    className="text-xs sm:text-[13px] font-light leading-relaxed max-w-lg"
                    style={{
                      color: '#000000',
                      fontFamily: "var(--font-jost), sans-serif",
                      letterSpacing: '0.03em',
                      lineHeight: '1.75'
                    }}
                  >
                    Experience the future of high jewellery through our exclusive AR suite. &ldquo;The Lens&rdquo; allows you to visualize every facet of your selection in your own environment, ensuring a perfect union between stone and wearer.
                  </p>

                  <div className="w-full mt-4">
                    <div className="flex flex-col items-start gap-2.5">
                      <div className="flex items-center gap-2.5 text-[var(--header-text)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#c5a880]">
                          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                          <circle cx="12" cy="12" r="1" />
                        </svg>
                        <span className="text-[10px] tracking-[0.2em] font-bold uppercase">AR Simulation</span>
                      </div>
                      <p className="text-[11px] leading-relaxed font-light max-w-sm" style={{ color: '#000000' }}>
                        Hyper-realistic scale mapping to visualize piece dimensions on skin with 99.8% accuracy.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => goToTab('jewelry')}
                    className="group cursor-pointer flex items-center gap-4 mt-6 text-[10px] tracking-[0.25em] font-bold uppercase text-[var(--header-text)] hover:opacity-80 transition-opacity duration-300"
                  >
                    Explore The Lens
                    <div className="w-10 h-px bg-[var(--header-text)] transition-all duration-300 group-hover:w-14" />
                    <span className="text-xs">&rarr;</span>
                  </button>
                </motion.div>

                <motion.div
                  className="col-span-1 lg:col-span-6 flex justify-center lg:justify-end"
                  initial={{ opacity: 0, x: 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="relative w-full max-w-[480px]">
                    <div
                      className="absolute -top-3 -left-3 w-32 h-32 border-t border-l pointer-events-none z-0"
                      style={{ borderColor: 'rgba(74, 64, 56, 0.15)', borderWidth: '1px' }}
                    />

                    <div className="relative w-full aspect-square overflow-hidden rounded-none border border-black/5 bg-[#f6f6f6] shadow-2xl z-10">
                      <img
                        src="/images/image copy.png"
                        alt="Stella Lens Visualization"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>
          </>
        )}

        <JewelrySection
          activeTab={activeTab}
          setActiveArProduct={requestTryOn}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onAddToCart={requestAddToCart}
          canAddToCart={!!user}
        />

        <CheckoutSection
          activeTab={activeTab}
          onBrowse={() => goToTab('jewelry')}
          onSignInClick={() => { setPending(null); setAuthModalOpen(true); }}
        />

        <AccountSection
          activeTab={activeTab}
          onBrowse={() => goToTab('jewelry')}
          onCheckout={() => goToTab('checkout')}
          onSignInClick={() => { setPending(null); setAuthModalOpen(true); }}
        />
      </main>

      <footer
        className="w-full py-14 flex flex-col items-center gap-5 text-center"
        style={{ borderTop: '1px solid rgba(74,64,56,0.07)', background: 'transparent' }}
      >
        <span
          className="flex items-center gap-2"
          style={{
            fontSize: '20px', letterSpacing: '0.4em',
            textTransform: 'uppercase', fontWeight: 300,
            color: 'var(--header-text)', fontFamily: "var(--font-jost), sans-serif",
          }}
        >
          STELLA LENS
        </span>
        <span className="label-white" style={{ fontSize: '9px' }}>Named for the night sky · Made to order</span>
        <div className="flex items-center gap-3">
          <div style={{ width: '40px', height: '1px', background: 'rgba(201,168,112,0.3)' }} />
          <Star size={7} color="var(--gold-fade)" />
          <div style={{ width: '40px', height: '1px', background: 'rgba(201,168,112,0.3)' }} />
        </div>
        <div className="flex gap-6">
          {(['home', 'jewelry'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => goToTab(tab)}
              className="underline-slide cursor-pointer"
              style={{
                background: 'none', border: 'none',
                fontSize: '9px', letterSpacing: '0.2em',
                textTransform: 'uppercase', color: 'var(--header-text-fade)',
                fontFamily: "var(--font-jost), sans-serif",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '9px', color: 'rgba(74,64,56,0.18)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          © 2026 StellaLens. All rights reserved.
        </span>
      </footer>

      {activeArProduct && (
        <ARView
          product={activeArProduct}
          onClose={() => setActiveArProduct(null)}
          onOpenOrderModal={(details: any) => {
            // AR feeds the bag, so there is one path to placing an order.
            const product = PRODUCTS.find((p) => p.id === details.productId);
            setActiveArProduct(null);
            if (product && requestAddToCart(product, details.customizations ?? {})) {
              goToTab('checkout');
            }
          }}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => { setAuthModalOpen(false); setPending(null); }}
        reason={
          pending?.kind === 'try-on'
            ? 'Sign in to try on jewellery. We save your ear fitting to your account, so you only set it up once.'
            : pending?.kind === 'add'
              ? 'Sign in to start a bag. We keep it on your account, so it is there on any device you use.'
              : undefined
        }
        onAuthenticated={() => {
          if (pending?.kind === 'try-on') setActiveArProduct(pending.product);
          if (pending?.kind === 'add') {
            const { product, customizations } = pending;
            setResumeAdd({ product, customizations });
          }
          setPending(null);
        }}
      />
    </div>
  );
}
