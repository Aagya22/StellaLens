'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCart, formatMoney, MAX_QUANTITY, CartLine } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { api, ApiError } from '@/lib/api';

interface CheckoutConfig {
  currency: string;
  deliveryMinor: number;
  freeDeliveryThresholdMinor: number;
  estimatedDays: string;
}

interface PlacedOrder {
  reference: string;
  totals: { subtotalMinor: number; deliveryMinor: number; totalMinor: number; currency: string };
  items: Array<{ productName: string; quantity: number; lineTotalMinor: number }>;
  shipping: { address: string; city: string; postalCode: string; country: string };
}

interface CheckoutSectionProps {
  activeTab: string;
  onBrowse: () => void;
  onSignInClick: () => void;
}

const Star = ({ size = 9, color = 'var(--gold)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
    <path d="M12 0c.7 6.4 5.1 11 12 12-6.9 1-11.3 5.6-12 12-.7-6.4-5.1-11-12-12 6.9-1 11.3-5.6 12-12z" />
  </svg>
);

const StarRule = () => (
  <div className="flex items-center gap-3 justify-center">
    <div style={{ width: '52px', height: '1px', background: 'var(--gold-fade)' }} />
    <Star size={8} color="var(--gold-fade)" />
    <div style={{ width: '52px', height: '1px', background: 'var(--gold-fade)' }} />
  </div>
);

const CornerMarks = ({ color = 'rgba(179,146,94,0.28)' }: { color?: string }) => (
  <>
    <div className="absolute top-2.5 left-2.5 w-4 h-4 pointer-events-none" style={{ borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` }} />
    <div className="absolute top-2.5 right-2.5 w-4 h-4 pointer-events-none" style={{ borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` }} />
    <div className="absolute bottom-2.5 left-2.5 w-4 h-4 pointer-events-none" style={{ borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` }} />
    <div className="absolute bottom-2.5 right-2.5 w-4 h-4 pointer-events-none" style={{ borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` }} />
  </>
);

const label: React.CSSProperties = {
  fontSize: '9px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'rgba(107,11,20,0.42)',
  fontFamily: "var(--font-jost), sans-serif",
};

const input: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--cream-border)',
  padding: '9px 0',
  fontFamily: "var(--font-jost), sans-serif",
  fontSize: '14px',
  color: 'var(--cream-text)',
  outline: 'none',
};

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--cream-border)',
  borderRadius: '16px',
  boxShadow: '0 14px 40px rgba(107,11,20,0.055)',
};

function SectionHead({ step, title, note }: { step: string; title: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-6">
      <span
        style={{
          fontFamily: "var(--font-cormorant), serif",
          fontSize: '20px', color: 'var(--gold)', lineHeight: 1,
        }}
      >
        {step}
      </span>
      <div className="flex flex-col gap-0.5">
        <h2 style={{ fontFamily: "var(--font-cormorant), serif", fontSize: '23px', fontWeight: 400, color: 'var(--cream-text)', lineHeight: 1.1 }}>
          {title}
        </h2>
        {note && <span style={{ ...label, letterSpacing: '0.12em', textTransform: 'none', fontSize: '11px' }}>{note}</span>}
      </div>
    </div>
  );
}

export default function CheckoutSection({ activeTab, onBrowse, onSignInClick }: CheckoutSectionProps) {
  const { lines, count, subtotalMinor, ready, setQuantity, remove, clear } = useCart();
  const { user, loading: authLoading } = useAuth();

  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('Nepal');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    api.get<CheckoutConfig>('/api/orders/config').then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    setName((v) => v || user.name);
    setEmail((v) => v || user.email);
  }, [user]);

  const deliveryMinor = useMemo(() => {
    if (!config || subtotalMinor === 0) return 0;
    return subtotalMinor >= config.freeDeliveryThresholdMinor ? 0 : config.deliveryMinor;
  }, [config, subtotalMinor]);

  const totalMinor = subtotalMinor + deliveryMinor;
  const toFreeDelivery = config ? config.freeDeliveryThresholdMinor - subtotalMinor : 0;
  const freeProgress = config
    ? Math.min(100, (subtotalMinor / config.freeDeliveryThresholdMinor) * 100)
    : 0;

  if (activeTab !== 'checkout') return null;

  const err = (key: string) =>
    fieldErrors[key] ? (
      <span style={{ fontSize: '10px', color: '#b3261e' }}>{fieldErrors[key]}</span>
    ) : null;

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (placing) return;
    setPlacing(true);
    setFieldErrors({});
    setFormError('');
    try {
      const res = await api.post<{ order: PlacedOrder }>('/api/orders', {
        customer: { name, email, phone },
        shipping: { address, city, postalCode, country, notes: notes || undefined },
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          customizations: l.customizations,
        })),
      });
      setPlaced(res.order);
      clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e2) {
      if (e2 instanceof ApiError) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(e2.fields ?? {})) flat[k.split('.').pop()!] = v;
        setFieldErrors(flat);
        if (e2.status === 401) setFormError('Please sign in again to place this order.');
        else if (Object.keys(flat).length === 0) setFormError(e2.message);
        else setFormError('Some details need checking below.');
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setPlacing(false);
    }
  };

  return (
    <section
      className="w-full flex flex-col items-center min-h-screen relative z-10"
      style={{
        background:
          'radial-gradient(1100px circle at 50% -10%, rgba(179,146,94,0.10) 0%, transparent 62%), #f6f5f3',
        paddingTop: '118px',
        paddingBottom: '90px',
      }}
    >
      <div className="w-full max-w-[1120px] px-5 sm:px-10">
        {/* ── Header ── */}
        <div className="flex flex-col items-center gap-4 mb-14">
          <span style={{ ...label, letterSpacing: '0.34em', color: 'var(--gold-bright)' }}>
            {placed ? 'Order Confirmed' : 'Checkout'}
          </span>
          <h1
            style={{
              fontFamily: "var(--font-cormorant), serif",
              fontSize: 'clamp(34px, 6vw, 56px)', fontWeight: 300,
              color: 'var(--cream-text)', letterSpacing: '0.01em', lineHeight: 1,
            }}
          >
            {placed ? 'Thank you' : 'Your Bag'}
          </h1>
          <StarRule />
          {!placed && count > 0 && (
            <span style={{ ...label, letterSpacing: '0.14em', textTransform: 'none', fontSize: '12px' }}>
              {count} {count === 1 ? 'piece' : 'pieces'}, each made to order
            </span>
          )}
        </div>

        {placed ? (
          <OrderConfirmation order={placed} onBrowse={onBrowse} />
        ) : !ready ? (
          <p style={{ ...label, textAlign: 'center' }}>Loading your bag…</p>
        ) : count === 0 ? (
          <EmptyBag onBrowse={onBrowse} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-8 lg:gap-12 items-start">
            <div className="flex flex-col gap-7">
              {/* ── Items ── */}
              <div style={{ ...card, padding: '28px 26px 8px' }}>
                <SectionHead step="01" title="Your pieces" />
                <div className="flex flex-col">
                  {lines.map((line, i) => (
                    <CartRow
                      key={line.key}
                      line={line}
                      last={i === lines.length - 1}
                      onQuantity={(q) => setQuantity(line.key, q)}
                      onRemove={() => remove(line.key)}
                    />
                  ))}
                </div>
              </div>

              {!authLoading && !user ? (
                <div style={{ ...card, padding: '30px 26px' }} className="relative flex flex-col gap-4 items-start">
                  <CornerMarks />
                  <SectionHead step="02" title="Sign in to continue" />
                  <p style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '13px', color: 'var(--cream-muted)', lineHeight: 1.8, marginTop: '-12px' }}>
                    Each piece is made to order, so we keep your order against your account.
                  </p>
                  <button
                    onClick={onSignInClick}
                    className="cursor-pointer"
                    style={{
                      background: 'var(--gold)', color: '#fff', border: 'none',
                      borderRadius: '999px', padding: '13px 32px',
                      fontFamily: "var(--font-jost), sans-serif",
                      fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase',
                    }}
                  >
                    Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={placeOrder} className="flex flex-col gap-7" id="checkout-form">
                  <div style={{ ...card, padding: '28px 26px' }}>
                    <SectionHead step="02" title="Contact" note="So we can confirm your order" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                      <Field id="co-name" text="Full name">
                        <input id="co-name" style={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
                        {err('name')}
                      </Field>
                      <Field id="co-phone" text="Phone">
                        <input id="co-phone" style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+977 98…" autoComplete="tel" required />
                        {err('phone')}
                      </Field>
                      <div className="sm:col-span-2">
                        <Field id="co-email" text="Email">
                          <input id="co-email" type="email" style={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                          {err('email')}
                        </Field>
                      </div>
                    </div>
                  </div>

                  <div style={{ ...card, padding: '28px 26px' }}>
                    <SectionHead step="03" title="Delivery address" note="Insured courier, signature required" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                      <div className="sm:col-span-2">
                        <Field id="co-address" text="Street address">
                          <input id="co-address" style={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House no., street, area" autoComplete="street-address" required />
                          {err('address')}
                        </Field>
                      </div>
                      <Field id="co-city" text="City">
                        <input id="co-city" style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kathmandu" autoComplete="address-level2" required />
                        {err('city')}
                      </Field>
                      <Field id="co-postal" text="Postal code">
                        <input id="co-postal" style={input} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="44600" autoComplete="postal-code" required />
                        {err('postalCode')}
                      </Field>
                      <div className="sm:col-span-2">
                        <Field id="co-country" text="Country">
                          <input id="co-country" style={input} value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country-name" required />
                          {err('country')}
                        </Field>
                      </div>
                      <div className="sm:col-span-2">
                        <Field id="co-notes" text="Delivery notes (optional)">
                          <textarea id="co-notes" rows={2} style={{ ...input, resize: 'none' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Landmark, preferred time…" />
                        </Field>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* ── Summary ── */}
            <aside className="w-full lg:sticky lg:top-28 flex flex-col gap-4">
              <div style={{ ...card, padding: '0', overflow: 'hidden' }} className="relative">
                <div
                  className="flex items-center justify-center gap-3 py-4"
                  style={{
                    background: 'linear-gradient(180deg, rgba(179,146,94,0.13), rgba(179,146,94,0.03))',
                    borderBottom: '1px solid var(--cream-border)',
                  }}
                >
                  <Star size={8} color="var(--gold)" />
                  <span style={{ ...label, letterSpacing: '0.26em', color: 'var(--gold-bright)' }}>
                    Order Summary
                  </span>
                  <Star size={8} color="var(--gold)" />
                </div>

                <div className="flex flex-col gap-3.5 px-7 py-6" style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '13px' }}>
                  <Row text={`Subtotal (${count} ${count === 1 ? 'item' : 'items'})`} value={formatMoney(subtotalMinor)} />
                  <Row
                    text="Delivery"
                    value={deliveryMinor === 0 ? 'Free' : formatMoney(deliveryMinor)}
                    valueColor={deliveryMinor === 0 ? '#5e7a52' : undefined}
                  />

                  {config && toFreeDelivery > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                      <div style={{ height: '3px', borderRadius: '999px', background: 'rgba(179,146,94,0.16)', overflow: 'hidden' }}>
                        <div style={{ width: `${freeProgress}%`, height: '100%', background: 'var(--gold)', transition: 'width 0.4s ease' }} />
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--cream-muted)', lineHeight: 1.5 }}>
                        {formatMoney(toFreeDelivery)} more for free delivery
                      </span>
                    </div>
                  )}

                  <div style={{ height: '1px', background: 'var(--cream-border)', margin: '6px 0' }} />

                  <div className="flex items-baseline justify-between">
                    <span style={{ ...label, color: 'var(--cream-text)', letterSpacing: '0.22em' }}>Total</span>
                    <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: '30px', color: 'var(--cream-text)', lineHeight: 1 }}>
                      {formatMoney(totalMinor)}
                    </span>
                  </div>

                  {formError && (
                    <span style={{ fontSize: '11px', color: '#b3261e', lineHeight: 1.5 }}>{formError}</span>
                  )}

                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={placing || !user || count === 0}
                    className="cursor-pointer"
                    style={{
                      background: 'var(--gold)', color: '#fff', border: 'none',
                      borderRadius: '999px', padding: '16px 20px', marginTop: '8px',
                      fontFamily: "var(--font-jost), sans-serif",
                      fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase',
                      opacity: placing || !user ? 0.45 : 1,
                      boxShadow: '0 8px 22px rgba(179,146,94,0.32)',
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {placing ? 'Placing order…' : 'Place Order'}
                  </button>
                </div>
              </div>

              {/* Reassurance, in the site's voice rather than generic badges */}
              <div style={{ ...card, padding: '18px 20px', boxShadow: 'none' }} className="flex flex-col gap-3">
                <Assurance title="No payment now" text="We confirm the final quote with you before any charge." />
                <Assurance title="Made to order" text={config ? `Delivered in ${config.estimatedDays}.` : 'Crafted for you after confirmation.'} />
                <Assurance title="Insured delivery" text="Tracked courier, signature on arrival." />
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}

function Assurance({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span style={{ marginTop: '3px', lineHeight: 0 }}><Star size={7} color="var(--gold-fade)" /></span>
      <div className="flex flex-col gap-0.5">
        <span style={{ ...label, letterSpacing: '0.14em', color: 'var(--cream-text)' }}>{title}</span>
        <span style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '11px', color: 'var(--cream-muted)', lineHeight: 1.6 }}>
          {text}
        </span>
      </div>
    </div>
  );
}

function Field({ id, text, children }: { id: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} style={label}>{text}</label>
      {children}
    </div>
  );
}

function Row({ text, value, valueColor }: { text: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: 'var(--cream-muted)' }}>{text}</span>
      <span style={{ color: valueColor ?? 'var(--cream-text)' }}>{value}</span>
    </div>
  );
}

function CartRow({
  line,
  last,
  onQuantity,
  onRemove,
}: {
  line: CartLine;
  last: boolean;
  onQuantity: (q: number) => void;
  onRemove: () => void;
}) {
  const custom = (['topGem', 'bottomGem', 'scale', 'metalTone'] as const)
    .map((k) => line.customizations[k])
    .filter(Boolean);

  return (
    <div
      className="flex items-start gap-5 py-6"
      style={{ borderBottom: last ? 'none' : '1px solid var(--cream-border)' }}
    >
      <div
        className="shrink-0 overflow-hidden relative"
        style={{
          width: '86px', height: '86px', borderRadius: '12px',
          background: 'linear-gradient(160deg, #fbf9f6, #f1ece4)',
          border: '1px solid rgba(179,146,94,0.22)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={line.product.image} alt={line.product.name} className="w-full h-full object-cover" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: '19px', color: 'var(--cream-text)', lineHeight: 1.25 }}>
          {line.product.name}
        </span>
        <span style={{ ...label, letterSpacing: '0.18em' }}>{line.product.category}</span>
        {custom.length > 0 && (
          <span style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '11px', color: 'var(--gold-bright)' }}>
            {custom.join(' · ')}
          </span>
        )}

        <div className="flex items-center gap-5 mt-2.5">
          <div className="flex items-center" style={{ border: '1px solid var(--cream-border)', borderRadius: '999px', background: '#fdfcfa' }}>
            <QtyButton onClick={() => onQuantity(line.quantity - 1)} disabled={line.quantity <= 1} text="−" />
            <span className="text-center" style={{ minWidth: '26px', fontFamily: "var(--font-jost), sans-serif", fontSize: '12px', color: 'var(--cream-text)' }}>
              {line.quantity}
            </span>
            <QtyButton onClick={() => onQuantity(line.quantity + 1)} disabled={line.quantity >= MAX_QUANTITY} text="+" />
          </div>
          <button
            onClick={onRemove}
            type="button"
            className="cursor-pointer"
            style={{ background: 'none', border: 'none', padding: 0, ...label, letterSpacing: '0.16em', color: 'rgba(107,11,20,0.38)' }}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="text-right shrink-0 flex flex-col gap-1">
        <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: '19px', color: 'var(--cream-text)' }}>
          {formatMoney(line.lineTotalMinor)}
        </span>
        {line.quantity > 1 && (
          <span style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '11px', color: 'var(--cream-muted)' }}>
            {formatMoney(line.unitPriceMinor)} each
          </span>
        )}
      </div>
    </div>
  );
}

function QtyButton({ onClick, disabled, text }: { onClick: () => void; disabled: boolean; text: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      className="cursor-pointer"
      style={{
        background: 'none', border: 'none', width: '30px', height: '30px',
        color: 'var(--cream-text)', opacity: disabled ? 0.25 : 1, lineHeight: 1, fontSize: '15px',
      }}
    >
      {text}
    </button>
  );
}

function EmptyBag({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="flex flex-col items-center gap-7 py-20 relative" style={{ ...card, padding: '70px 24px' }}>
      <CornerMarks />
      <Star size={16} color="var(--gold-fade)" />
      <p style={{ fontFamily: "var(--font-cormorant), serif", fontSize: '22px', color: 'var(--cream-text)' }}>
        Your bag is empty
      </p>
      <p style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '12px', color: 'var(--cream-muted)', textAlign: 'center', maxWidth: '300px', lineHeight: 1.8 }}>
        Every piece is made to order. Find one you love, or try it on first.
      </p>
      <button
        onClick={onBrowse}
        className="cursor-pointer"
        style={{
          background: 'transparent', color: 'var(--gold-bright)',
          border: '1px solid var(--gold-fade)', borderRadius: '999px', padding: '13px 34px',
          fontFamily: "var(--font-jost), sans-serif",
          fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase',
        }}
      >
        Browse the collection
      </button>
    </div>
  );
}

function OrderConfirmation({ order, onBrowse }: { order: PlacedOrder; onBrowse: () => void }) {
  return (
    <div className="max-w-[580px] mx-auto flex flex-col gap-7 relative" style={{ ...card, padding: '40px 34px' }}>
      <CornerMarks />

      <p style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '13px', color: 'var(--cream-muted)', lineHeight: 1.9, textAlign: 'center' }}>
        Your order is with our atelier. We&apos;ll be in touch within 24 hours to
        confirm the details and the final quote.
      </p>

      <div
        className="flex flex-col items-center gap-1.5 py-5"
        style={{ background: 'rgba(179,146,94,0.06)', borderRadius: '12px', border: '1px solid rgba(179,146,94,0.18)' }}
      >
        <span style={label}>Order reference</span>
        <span style={{ fontFamily: 'monospace', fontSize: '17px', color: 'var(--gold-bright)', letterSpacing: '0.08em' }}>
          {order.reference}
        </span>
      </div>

      <div className="flex flex-col gap-2.5" style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '13px' }}>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between gap-4">
            <span style={{ color: 'var(--cream-muted)' }}>
              {item.productName} × {item.quantity}
            </span>
            <span style={{ color: 'var(--cream-text)' }}>{formatMoney(item.lineTotalMinor)}</span>
          </div>
        ))}
        <div style={{ height: '1px', background: 'var(--cream-border)', margin: '6px 0' }} />
        <Row text="Subtotal" value={formatMoney(order.totals.subtotalMinor)} />
        <Row
          text="Delivery"
          value={order.totals.deliveryMinor === 0 ? 'Free' : formatMoney(order.totals.deliveryMinor)}
          valueColor={order.totals.deliveryMinor === 0 ? '#5e7a52' : undefined}
        />
        <div className="flex justify-between items-baseline mt-1">
          <span style={{ ...label, color: 'var(--cream-text)', letterSpacing: '0.22em' }}>Total</span>
          <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: '27px', color: 'var(--cream-text)' }}>
            {formatMoney(order.totals.totalMinor)}
          </span>
        </div>
      </div>

      <StarRule />

      <div className="flex flex-col gap-1 items-center text-center">
        <span style={label}>Delivering to</span>
        <span style={{ fontFamily: "var(--font-jost), sans-serif", fontSize: '13px', color: 'var(--cream-text)', lineHeight: 1.7 }}>
          {order.shipping.address}, {order.shipping.city} {order.shipping.postalCode}, {order.shipping.country}
        </span>
      </div>

      <button
        onClick={onBrowse}
        className="cursor-pointer"
        style={{
          background: 'transparent', color: 'var(--gold-bright)',
          border: '1px solid var(--gold-fade)', borderRadius: '999px', padding: '13px 20px',
          fontFamily: "var(--font-jost), sans-serif",
          fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase',
        }}
      >
        Continue browsing
      </button>
    </div>
  );
}
