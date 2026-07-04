'use client';

import { useState } from 'react';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderDetails: {
    productId: string;
    productName: string;
    price: string;
    customizations: {
      topGem?: string;
      bottomGem?: string;
      scale: string;
    };
  } | null;
}

export default function OrderModal({ isOpen, onClose, orderDetails }: OrderModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !orderDetails) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Mock API call to simulate saving order to database (MongoDB)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-[#1a1a1a]">
      <div className="relative w-full max-w-lg bg-[#FDFAF7] border border-[#5F3041]/10 rounded-2xl p-6 md:p-8 overflow-hidden shadow-2xl">
        
        {/* Decorative celestial background glow matching MoonStella warm branding */}
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#5F3041]/5 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#F5F0EB] border border-transparent hover:border-[#5F3041]/10 transition-all cursor-pointer text-slate-400 hover:text-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {success ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-[#5F3041]/5 border border-[#5F3041]/20 flex items-center justify-center mx-auto mb-6 text-[#5F3041]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-light tracking-wide text-[#1a1a1a]">Bespoke Order Received</h3>
            <p className="text-sm text-slate-600 font-light mt-3 leading-relaxed">
              Thank you for choosing **StellaLens**. Our master jeweler will review your custom configuration and contact you at **{email}** within 24 hours.
            </p>
            <button
              onClick={onClose}
              className="mt-8 px-8 py-3 bg-[#5F3041] hover:bg-[#4A2231] text-white font-bold rounded-xl transition-all tracking-widest uppercase text-xs shadow-md cursor-pointer"
            >
              Continue Browsing
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <span className="text-[9px] tracking-[0.2em] font-bold text-[#5F3041] uppercase block">Order Configuration</span>
              <h3 className="text-2xl font-light tracking-wide mt-1 text-[#1a1a1a]">{orderDetails.productName}</h3>
              <p className="text-lg text-[#5F3041] font-semibold mt-1">{orderDetails.price}</p>
            </div>

            {/* Customization Details card */}
            <div className="bg-[#F5F0EB]/60 border border-[#5F3041]/10 rounded-xl p-4 space-y-2 text-xs font-light text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Fitting Scale:</span>
                <span className="font-mono text-[#5F3041] font-semibold">{orderDetails.customizations.scale}x</span>
              </div>
              {orderDetails.customizations.topGem && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Top Gem Selection:</span>
                  <span className="font-semibold text-[#5F3041] capitalize">{orderDetails.customizations.topGem}</span>
                </div>
              )}
              {orderDetails.customizations.bottomGem && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Bottom Gem Selection:</span>
                  <span className="font-semibold text-[#5F3041] capitalize">{orderDetails.customizations.bottomGem}</span>
                </div>
              )}
            </div>

            <hr className="border-[#5F3041]/10" />

            <div className="space-y-4">
              <span className="text-[9px] tracking-[0.2em] font-bold text-[#5F3041] uppercase block">Delivery Information</span>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-light" htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-white border border-[#5F3041]/15 rounded-xl focus:border-[#5F3041] focus:ring-1 focus:ring-[#5F3041] focus:outline-none transition-all text-sm font-light text-[#1a1a1a]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-light" htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 bg-white border border-[#5F3041]/15 rounded-xl focus:border-[#5F3041] focus:ring-1 focus:ring-[#5F3041] focus:outline-none transition-all text-sm font-light text-[#1a1a1a]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 font-light" htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+977 98..."
                    className="w-full px-4 py-3 bg-white border border-[#5F3041]/15 rounded-xl focus:border-[#5F3041] focus:ring-1 focus:ring-[#5F3041] focus:outline-none transition-all text-sm font-light text-[#1a1a1a]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500 font-light" htmlFor="address">Delivery Address</label>
                <textarea
                  id="address"
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Zip Code"
                  className="w-full px-4 py-3 bg-white border border-[#5F3041]/15 rounded-xl focus:border-[#5F3041] focus:ring-1 focus:ring-[#5F3041] focus:outline-none transition-all text-sm font-light text-[#1a1a1a] resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#5F3041] hover:bg-[#4A2231] text-white font-bold rounded-xl transition-all tracking-widest uppercase text-xs flex items-center justify-center disabled:opacity-50 cursor-pointer shadow-md hover:shadow-lg"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing Order...
                </>
              ) : (
                'Place Custom Order'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
