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
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden fade-in"
        style={{
          background: '#111111',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <span
            style={{
              fontSize: '9px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'var(--red)',
              fontFamily: "var(--font-space), sans-serif",
              fontWeight: 500,
            }}
          >
            — Order Configuration
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 0,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            {/* X */}
            <svg width="18" height="18" viewBox="0 0 46.1 46.1" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="0.4" y1="0.4" x2="45.7" y2="45.7" />
              <line x1="0.4" y1="45.7" x2="45.7" y2="0.4" />
            </svg>
          </button>
        </div>

        <div className="px-8 py-8">
          {success ? (
            /* ── Success State ── */
            <div className="flex flex-col items-center text-center gap-6 py-8">
              <div
                className="w-14 h-14 flex items-center justify-center"
                style={{ border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <svg width="22" height="22" fill="none" stroke="var(--white)" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3
                  className="font-editorial"
                  style={{ fontSize: '28px', fontWeight: 300, color: 'var(--white)', letterSpacing: '0.03em' }}
                >
                  Order Received
                </h3>
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 300,
                    color: 'rgba(255,255,255,0.5)',
                    lineHeight: 1.8,
                    marginTop: '12px',
                    maxWidth: '320px',
                  }}
                >
                  Thank you for choosing StellaLens. Our jeweller will review your configuration and contact you at{' '}
                  <span style={{ color: 'var(--white)' }}>{email}</span> within 24 hours.
                </p>
              </div>
              <button className="btn-ghost" onClick={onClose} style={{ marginTop: '8px' }}>
                Continue Browsing
              </button>
            </div>
          ) : (
            /* ── Order Form ── */
            <form onSubmit={handleSubmit} className="flex flex-col gap-7">

              {/* Product info */}
              <div>
                <h3
                  className="font-editorial"
                  style={{ fontSize: '26px', fontWeight: 300, color: 'var(--white)', letterSpacing: '0.03em' }}
                >
                  {orderDetails.productName}
                </h3>
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 300,
                    color: 'var(--white)',
                    letterSpacing: '0.05em',
                    display: 'block',
                    marginTop: '6px',
                  }}
                >
                  {orderDetails.price}
                </span>
              </div>

              {/* Customisation summary */}
              <div
                className="flex flex-col gap-3 py-5 px-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span style={{ fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: "var(--font-space), sans-serif" }}>
                  Your Configuration
                </span>
                {[
                  { label: 'Fitting Scale', value: `${orderDetails.customizations.scale}×` },
                  orderDetails.customizations.topGem && { label: 'Top Gem', value: orderDetails.customizations.topGem },
                  orderDetails.customizations.bottomGem && { label: 'Bottom Gem', value: orderDetails.customizations.bottomGem },
                ].filter(Boolean).map((row: any) => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>{row.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--white)', fontWeight: 400, textTransform: 'capitalize' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Delivery fields */}
              <div className="flex flex-col gap-6">
                <span style={{ fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', fontFamily: "var(--font-space), sans-serif" }}>
                  Delivery Information
                </span>

                <div className="flex flex-col gap-1">
                  <label style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }} htmlFor="modal-name">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="modal-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="input-dark"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }} htmlFor="modal-email">
                      Email
                    </label>
                    <input
                      type="email"
                      id="modal-email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input-dark"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }} htmlFor="modal-phone">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="modal-phone"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+977 98..."
                      className="input-dark"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }} htmlFor="modal-address">
                    Delivery Address
                  </label>
                  <textarea
                    id="modal-address"
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, City, Zip Code"
                    className="input-dark"
                    style={{ resize: 'none' }}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
                style={{ borderRadius: 0, width: '100%', opacity: loading ? 0.6 : 1 }}
              >
                {loading ? (
                  <>
                    <div
                      className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin"
                    />
                    Processing...
                  </>
                ) : (
                  'Place Custom Order'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
