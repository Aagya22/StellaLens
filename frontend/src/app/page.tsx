'use client';

import { useState } from 'react';
import { PRODUCTS, Product } from '@/data/products';
import ARView from '@/components/ARView';
import OrderModal from '@/components/OrderModal';

type Tab = 'home' | 'jewelry' | 'about';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [activeArProduct, setActiveArProduct] = useState<Product | null>(null);
  const [orderData, setOrderData] = useState<any | null>(null);
  
  // Jewelry page search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'earrings' | 'necklaces'>('all');

  const handleOpenOrder = (data: any) => {
    setOrderData(data);
  };

  const getProductBackdrop = (id: string) => {
    if (id === 'earring_diamond') {
      return 'from-[#FDFBF7] via-[#F3EFE9] to-[#E6DEC9]/30';
    } else if (id === 'earring_gold_hoop') {
      return 'from-[#FFFDF9] via-[#FAF6EE] to-[#EFE2C5]/30';
    } else {
      return 'from-[#FAF8F5] via-[#EFEBE4] to-[#DFD5C6]/35';
    }
  };

  // Filter jewelry catalog
  const filteredProducts = PRODUCTS.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen w-full bg-[#FCF9F8] text-[#1a1a1a] font-sans flex flex-col items-center justify-between overflow-x-hidden selection:bg-[#5F3041]/20 selection:text-[#5F3041]">

      {/* 2. Swarovski-inspired Luxury Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#FCF9F8]/95 backdrop-blur-md border-b border-[#5F3041]/10 px-6 sm:px-12 py-5 shadow-sm transition-all duration-300 w-full flex justify-center">
        <div className="max-w-7xl w-full flex flex-col items-center gap-4">
          
          {/* Logo Center */}
          <div className="flex items-center justify-between w-full relative h-10">
            {/* Left spacing for alignment */}
            <div className="w-24 hidden md:block" />
            
            {/* Brand Logo */}
            <button 
              onClick={() => setActiveTab('home')}
              className="absolute left-1/2 -translate-x-1/2 text-2xl sm:text-3xl font-light tracking-[0.3em] text-[#1a1a1a] hover:opacity-90 transition-opacity font-sans focus:outline-none cursor-pointer whitespace-nowrap"
            >
              STELLA<span className="font-semibold text-[#5F3041]">LENS</span>
            </button>
            
            {/* Quick Actions (Wishlist / Bag Icons) */}
            <div className="flex items-center gap-4 text-[#5F3041] relative z-10">
              <button className="hover:opacity-75 transition-opacity" title="Wishlist">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button className="hover:opacity-75 transition-opacity relative" title="Shopping Bag">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {orderData && (
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-amber-500 rounded-full text-[8px] font-bold text-black flex items-center justify-center animate-ping" />
                )}
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex gap-8 border-t border-[#5F3041]/5 w-full justify-center pt-3 mt-1">
            {(['home', 'jewelry', 'about'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-semibold tracking-[0.2em] uppercase py-1 border-b-2 transition-all duration-300 focus:outline-none cursor-pointer ${
                    isActive 
                      ? 'border-[#5F3041] text-[#5F3041] font-bold scale-105' 
                      : 'border-transparent text-slate-500 hover:text-[#5F3041]'
                  }`}
                >
                  {tab === 'about' ? 'about us' : tab}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Decorative ambient glows */}
      <div className="absolute top-[200px] right-0 w-[500px] h-[500px] rounded-full bg-[#5F3041]/3 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[200px] left-[-100px] w-[500px] h-[500px] rounded-full bg-amber-500/2 blur-[100px] pointer-events-none" />

      {/* 3. Main Content Switching */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 sm:px-12 py-10 md:py-16 flex flex-col justify-center">
        
        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <div className="space-y-24 fade-in">
            {/* Hero Banner Section */}
            <section className="relative w-full rounded-3xl overflow-hidden border border-[#5F3041]/10 bg-gradient-to-br from-[#FDFAF7] via-[#F5F0EB]/90 to-[#FDFAF7] p-8 sm:p-12 lg:p-16 min-h-[550px] shadow-sm flex flex-col justify-center">
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none flex items-center justify-end pr-24">
                <svg width="400" height="400" viewBox="0 0 100 100" fill="none" stroke="#5F3041" strokeWidth="0.5">
                  <circle cx="50" cy="50" r="40" />
                  <polygon points="50,15 85,50 50,85 15,50" />
                  <path d="M50 10 L50 90" />
                </svg>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10 w-full">
                {/* Hero Text Content */}
                <div className="lg:col-span-6 space-y-6 flex flex-col items-center text-center justify-center">
                  <span className="text-[10px] tracking-[0.3em] font-bold text-[#5F3041] uppercase flex items-center gap-2">
                    ✦ NEW CELESTIAL ARRIVALS
                  </span>
                  <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-wide leading-tight text-[#2E0820] font-serif">
                    Astraea Diamonds<br />
                    <span className="font-serif italic font-medium text-[#5F3041]">Forged in Light.</span>
                  </h1>
                  <p className="text-slate-600 text-sm sm:text-base font-light leading-relaxed max-w-lg mx-auto">
                    Explore our luxury fitting room. Select standard designs or create your bespoke configurations with custom Rubies and Tanzanites, calibrated to fit you perfectly.
                  </p>
                  <div className="pt-4">
                    <button
                      onClick={() => setActiveTab('jewelry')}
                      className="px-8 py-3.5 bg-[#5F3041] hover:bg-[#4A2231] text-white text-xs tracking-widest font-bold uppercase rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
                    >
                      Enter Showroom
                    </button>
                  </div>
                </div>

                {/* Jewelry Collage */}
                <div className="lg:col-span-6 relative w-full h-[400px] md:h-[450px] mt-8 lg:mt-0 flex items-center justify-center">
                  {/* Image 1: Diamond Earrings */}
                  <div className="absolute top-0 left-4 md:left-12 w-36 h-36 sm:w-40 sm:h-40 md:w-52 md:h-52 rounded-2xl overflow-hidden border border-[#5F3041]/10 bg-white shadow-md rotate-[-6deg] hover:rotate-0 hover:scale-105 hover:z-30 transition-all duration-300 cursor-pointer">
                    <img src="/images/earrings1.png" alt="Diamond Earrings" className="w-full h-full object-cover" />
                  </div>
                  {/* Image 2: Gold Hoops */}
                  <div className="absolute top-6 right-4 md:right-12 w-32 h-32 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden border border-[#5F3041]/10 bg-white shadow-md rotate-[4deg] hover:rotate-0 hover:scale-105 hover:z-30 transition-all duration-300 cursor-pointer">
                    <img src="/images/earrings2.png" alt="Gold Hoops" className="w-full h-full object-cover" />
                  </div>
                  {/* Image 3: Celestial Chain */}
                  <div className="absolute bottom-4 left-6 md:left-16 w-32 h-32 sm:w-36 sm:h-36 md:w-48 md:h-48 rounded-2xl overflow-hidden border border-[#5F3041]/10 bg-white shadow-md rotate-[3deg] hover:rotate-0 hover:scale-105 hover:z-30 transition-all duration-300 cursor-pointer">
                    <img src="/images/necklace1.png" alt="Celestial Chain" className="w-full h-full object-cover" />
                  </div>
                  {/* Image 4: Diamond Ring */}
                  <div className="absolute bottom-0 right-6 md:right-16 w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border border-[#5F3041]/10 bg-white shadow-md rotate-[-4deg] hover:rotate-0 hover:scale-105 hover:z-30 transition-all duration-300 cursor-pointer">
                    <img src="/images/ring1.png" alt="Diamond Ring" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </section>

            {/* Featured Categories (Swarovski style grid banner) */}
            <section className="space-y-8">
              <div className="text-center space-y-2">
                <p className="text-[9px] tracking-[0.25em] font-bold text-[#5F3041] uppercase">Browse the Atelier</p>
                <h2 className="text-3xl font-light font-serif text-[#2E0820]">Shop by Category</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Category 1: Earrings */}
                <div className="group relative rounded-2xl overflow-hidden border border-[#5F3041]/10 bg-gradient-to-tr from-[#FDFAF7] to-[#EADEC9]/20 p-8 sm:p-12 flex flex-col justify-between items-center text-center min-h-[350px] shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none flex items-center justify-center">
                    <svg width="250" height="250" viewBox="0 0 100 100" fill="none" stroke="#5F3041" strokeWidth="0.5">
                      <polygon points="50,10 90,50 50,90 10,50" />
                    </svg>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] tracking-[0.2em] font-bold text-[#5F3041] uppercase">Sparkling Accents</span>
                    <h3 className="text-2xl font-light font-serif mt-2 text-[#2E0820] group-hover:text-[#5F3041] transition-colors">Fine Earrings</h3>
                    <p className="text-xs text-slate-500 font-light mt-3 max-w-xs leading-relaxed mx-auto">
                      Calibrated drop styles and mirror-finish hoops crafted in premium solid yellow and white gold.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCategory('earrings');
                      setActiveTab('jewelry');
                    }}
                    className="mt-6 text-xs font-semibold tracking-wider text-[#5F3041] hover:text-[#4A2231] transition-colors underline underline-offset-4 uppercase"
                  >
                    View Collection →
                  </button>
                </div>

                {/* Category 2: Necklaces */}
                <div className="group relative rounded-2xl overflow-hidden border border-[#5F3041]/10 bg-gradient-to-tr from-[#FDFAF7] to-[#DFD5C6]/30 p-8 sm:p-12 flex flex-col justify-between items-center text-center min-h-[350px] shadow-sm hover:shadow-lg transition-all duration-300">
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none flex items-center justify-center">
                    <svg width="250" height="250" viewBox="0 0 100 100" fill="none" stroke="#5F3041" strokeWidth="0.5">
                      <circle cx="50" cy="50" r="40" />
                    </svg>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] tracking-[0.2em] font-bold text-[#5F3041] uppercase">Statement Collars</span>
                    <h3 className="text-2xl font-light font-serif mt-2 text-[#2E0820] group-hover:text-[#5F3041] transition-colors">Articulated Necklaces</h3>
                    <p className="text-xs text-slate-500 font-light mt-3 max-w-xs leading-relaxed mx-auto">
                      Fluid curves designed to sit gracefully on the neck. Artisanally carved and polished.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCategory('necklaces');
                      setActiveTab('jewelry');
                    }}
                    className="mt-6 text-xs font-semibold tracking-wider text-[#5F3041] hover:text-[#4A2231] transition-colors underline underline-offset-4 uppercase"
                  >
                    View Collection →
                  </button>
                </div>
              </div>
            </section>

            {/* Trending Item Spotlight */}
            <section className="bg-[#FDFAF7] border border-[#5F3041]/10 rounded-3xl p-8 sm:p-16 flex flex-col items-center text-center gap-10 shadow-sm max-w-4xl mx-auto">
              <div className="space-y-6 flex flex-col items-center">
                <span className="text-[9px] tracking-[0.3em] font-bold text-amber-600 uppercase block">✦ TRENDING NOW</span>
                <h3 className="text-3xl font-light font-serif text-[#2E0820]">Astraea Diamond Drops</h3>
                <p className="text-sm text-slate-600 font-light leading-relaxed max-w-xl mx-auto">
                  Our signature design showcasing a vivid Ruby stud matching with a rich Tanzanite drops teardrop, set in a gold halo of micro diamonds.
                </p>
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      const ast = PRODUCTS.find(p => p.id === 'earring_diamond');
                      if (ast) setActiveArProduct(ast);
                    }}
                    className="px-6 py-3 bg-[#5F3041] hover:bg-[#4A2231] text-white text-xs tracking-widest font-bold uppercase rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Try On Live
                  </button>
                </div>
              </div>
              <div className="w-full max-w-[320px] aspect-square rounded-2xl border border-[#5F3041]/10 bg-white flex items-center justify-center relative overflow-hidden shadow-md group hover:shadow-xl transition-all duration-300">
                <img src="/images/earrings1.png" alt="Astraea Diamond Drops" className="w-full h-full object-cover" />
              </div>
            </section>
          </div>
        )}

        {/* ==================== JEWELRY CATALOG TAB ==================== */}
        {activeTab === 'jewelry' && (
          <div className="space-y-12 fade-in">
            {/* Header & Filter Controls */}
            <div className="space-y-8 border-b border-[#5F3041]/10 pb-8">
              <div className="text-center space-y-2">
                <p className="text-[9px] tracking-[0.25em] font-bold text-[#5F3041] uppercase">The Atelier Collection</p>
                <h2 className="text-3xl font-light font-serif text-[#2E0820]">Fine Jewelry Catalog</h2>
              </div>

              {/* Search and Category filters (Swarovski style) */}
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between max-w-4xl mx-auto pt-4">
                
                {/* Search Bar */}
                <div className="relative w-full md:w-80">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search collection..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#5F3041]/15 rounded-xl text-xs font-light focus:border-[#5F3041] focus:ring-1 focus:ring-[#5F3041] focus:outline-none transition-all text-[#1a1a1a]"
                  />
                </div>

                {/* Category filters */}
                <div className="flex gap-2 w-full md:w-auto justify-center md:justify-end">
                  {(['all', 'earrings', 'necklaces'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-5 py-2.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all border cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-[#5F3041] border-transparent text-white shadow-sm'
                          : 'bg-white/50 border-[#5F3041]/10 hover:border-[#5F3041]/30 text-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Catalog Grid */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 text-slate-400 font-light">
                No jewelry items match your active search filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="group relative bg-white border border-[#5F3041]/10 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-[#5F3041]/30 hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 shadow-sm"
                  >
                    {/* Visual Card */}
                    <div className={`w-full aspect-[4/3] bg-gradient-to-tr ${getProductBackdrop(product.id)} flex items-center justify-center p-6 border-b border-[#5F3041]/5 relative`}>
                      <div className="absolute inset-0 opacity-5 flex items-center justify-center">
                        <div className="w-32 h-32 rounded-full border border-[#5F3041]" />
                      </div>

                      <img src={product.image} alt={product.name} className="max-h-[80%] max-w-[80%] object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300 relative z-10" />

                      {product.arEnabled && (
                        <span className="absolute top-4 right-4 bg-white/80 border border-[#5F3041]/10 px-3 py-1 rounded-full text-[9px] font-bold text-[#5F3041] tracking-wider uppercase backdrop-blur-md z-20">
                          ✦ Try On Live
                        </span>
                      )}
                    </div>

                    <div className="p-6 space-y-4 flex flex-col items-center text-center">
                      <div className="w-full flex flex-col items-center">
                        <h3 className="text-xl font-light tracking-wide text-[#2E0820] font-serif group-hover:text-[#5F3041] transition-colors">
                          {product.name}
                        </h3>
                        <span className="text-lg text-[#5F3041] font-semibold font-sans mt-2">{product.price}</span>
                        <div className="text-[10px] text-amber-500 flex gap-0.5 mt-1.5 justify-center">
                          <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 font-light leading-relaxed h-12 overflow-hidden max-w-xs mx-auto">
                        {product.description}
                      </p>

                      <div className="pt-4 border-t border-[#5F3041]/5 w-full flex justify-center">
                        <button
                          onClick={() => setActiveArProduct(product)}
                          className="w-full py-3.5 bg-[#5F3041] hover:bg-[#4A2231] text-white text-xs tracking-widest uppercase font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Try On Live
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== ABOUT US TAB ==================== */}
        {activeTab === 'about' && (
          <div className="space-y-16 max-w-4xl mx-auto fade-in">
            {/* Title */}
            <div className="text-center space-y-2">
              <p className="text-[9px] tracking-[0.25em] font-bold text-[#5F3041] uppercase">Our Heritage & Craft</p>
              <h2 className="text-3xl md:text-4xl font-light font-serif text-[#2E0820]">About StellaLens</h2>
            </div>

            {/* Content Story Grid */}
            <div className="space-y-16 text-slate-700 font-light leading-relaxed text-sm">
              <div className="flex flex-col items-center text-center space-y-8">
                <div className="space-y-4 max-w-2xl mx-auto">
                  <h3 className="text-2xl font-serif text-[#2E0820] font-light">Heritage Meets Next-Gen Fitting</h3>
                  <p>
                    StellaLens was founded on the vision of bridging ancient jewelry-making traditions with state-of-the-art visual technology. We custom design each piece from raw components, ensuring that every Ruby, Tanzanite, and Diamond halo reflects pure luxury.
                  </p>
                  <p>
                    Part of the MoonStella Collection, we hold ourselves to the highest standards of materials and craftsmanship, sourcing exclusively ethical stones and conflict-free yellow and white gold.
                  </p>
                </div>
                <div className="w-full max-w-xl aspect-video rounded-2xl border border-[#5F3041]/10 bg-gradient-to-tr from-[#FDFAF7] to-[#FAF6EE] flex items-center justify-center p-6 shadow-md">
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#5F3041]">Crafted in 18K Solid Gold</span>
                </div>
              </div>

              <hr className="border-[#5F3041]/10" />

              {/* The VTO Tech */}
              <div className="flex flex-col items-center text-center space-y-8">
                <div className="space-y-4 max-w-2xl mx-auto">
                  <h3 className="text-2xl font-serif text-[#2E0820] font-light">Virtual fitting. Flawless simulation.</h3>
                  <p>
                    Our virtual try-on module utilizes high-performance computer vision algorithms. By tracking landmarks on the cheek, jawline, and chin corner, we calculate the face's exact depth coordinates and scale factors.
                  </p>
                  <p>
                    With integrated velocity lookahead projection and physical harmonic osculation swing simulation, the jewelry reacts dynamically to your movements under simulated gravitational fields.
                  </p>
                </div>
                <div className="w-full max-w-xl aspect-video rounded-2xl border border-[#5F3041]/10 bg-gradient-to-tr from-[#FAF8F5] to-[#EFEBE4] flex items-center justify-center p-6 shadow-md">
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#5F3041]">85ms Smoothing Tracker</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 4. Persistent Footer */}
      <footer className="w-full border-t border-[#5F3041]/10 bg-[#FDFAF7] py-12 text-center space-y-4">
        <p className="text-[9px] text-[#5F3041] tracking-widest font-semibold uppercase">
          STELLALENS FINE JEWELRY
        </p>
        <p className="text-[9px] text-slate-500 tracking-widest font-light uppercase">
          © 2026 STELLALENS FINE JEWELRY. ALL RIGHTS RESERVED.
        </p>
        <p className="text-[8px] text-slate-400 tracking-widest uppercase">
          ✦ CELESTIAL FITTING ROOM CREATED FOR THE MOONSTELLA BRAND ✦
        </p>
      </footer>

      {/* AR View Fullscreen Overlay */}
      {activeArProduct && (
        <ARView
          product={activeArProduct}
          onClose={() => setActiveArProduct(null)}
          onOpenOrderModal={handleOpenOrder}
        />
      )}

      {/* Bespoke Order Modal */}
      <OrderModal
        isOpen={orderData !== null}
        onClose={() => setOrderData(null)}
        orderDetails={orderData}
      />
    </div>
  );
}
