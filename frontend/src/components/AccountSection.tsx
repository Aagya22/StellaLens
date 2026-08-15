'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCart, formatMoney } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import { api, ApiError, PastOrder } from '@/lib/api';

interface AccountSectionProps {
  activeTab: string;
  onBrowse: () => void;
  onCheckout: () => void;
  onSignInClick: () => void;
}

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

const card: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid var(--cream-border)',
  borderRadius: '16px',
  boxShadow: '0 14px 40px rgba(107,11,20,0.055)',
};

const value: React.CSSProperties = {
  fontFamily: "var(--font-jost), sans-serif",
  fontSize: '14px',
  color: 'var(--cream-text)',
};

function SectionHead({ step, title, note }: { step: string; title: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-6">
      <span style={{ fontFamily: "var(--font-cormorant), serif", fontSize: '20px', color: 'var(--gold)', lineHeight: 1 }}>
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

const pillButton = (filled: boolean): React.CSSProperties => ({
  background: filled ? 'var(--gold)' : 'none',
  color: filled ? '#fff' : 'var(--cream-text)',
  border: filled ? 'none' : '1px solid var(--cream-border)',
  borderRadius: '999px',
  padding: '10px 20px',
  fontFamily: "var(--font-jost), sans-serif",
  fontSize: '9.5px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
});

const STATUS_COPY: Record<PastOrder['status'], { text: string; color: string }> = {
  new: { text: 'Received', color: 'var(--gold-bright)' },
  contacted: { text: 'In progress', color: '#6b7f96' },
  fulfilled: { text: 'Delivered', color: '#5f7a55' },
  cancelled: { text: 'Cancelled', color: 'rgba(107,11,20,0.45)' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AccountSection({
  activeTab,
  onBrowse,
  onCheckout,
  onSignInClick,
}: AccountSectionProps) {
  const { user, loading: authLoading, clearCalibration } = useAuth();
  const { count, subtotalMinor, ready: cartReady } = useCart();
  const { toast } = useToast();

  const [orders, setOrders] = useState<PastOrder[] | null>(null);
  const [ordersError, setOrdersError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const isOpen = activeTab === 'account';

  const loadOrders = useCallback(async () => {
    setOrdersError(false);
    try {
      const res = await api.get<{ orders: PastOrder[] }>('/api/orders/mine');
      setOrders(res.orders);
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 401)) setOrdersError(true);
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !user) { setOrders(null); return; }
    void loadOrders();
  }, [isOpen, user, loadOrders]);

  if (!isOpen) return null;

  const resetCalibration = async () => {
    try {
      await clearCalibration();
      toast({
        kind: 'success',
        title: 'Ear fitting cleared',
        message: 'Next time you try on earrings, you will be asked to tap your lobes again.',
      });
    } catch {
      toast({ kind: 'error', title: 'Could not clear the fitting', message: 'Please try again in a moment.' });
    } finally {
      setConfirmReset(false);
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
        <div className="flex flex-col items-center mb-20 pb-2">
          <h1
            className="font-editorial"
            style={{
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
              fontSize: 'clamp(36px, 5vw, 60px)', fontWeight: 300,
              color: 'var(--cream-text)', letterSpacing: '0.03em',
              lineHeight: 1.15, textAlign: 'center',
            }}
          >
            Account
          </h1>
        </div>

        {authLoading ? (
          <p style={{ ...label, textAlign: 'center' }}>Checking your session…</p>
        ) : !user ? (
          <div style={{ ...card, padding: '44px 30px' }} className="relative flex flex-col items-center gap-5 text-center">
            <CornerMarks />
            <p style={{ ...value, fontSize: '13px', color: 'rgba(107,11,20,0.6)', maxWidth: '380px', lineHeight: 1.7 }}>
              Sign in to see your details, your saved ear fitting, your bag, and everything you have ordered.
            </p>
            <button onClick={onSignInClick} className="cursor-pointer" style={pillButton(true)}>
              Sign In
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-8 lg:gap-12 items-start">
            <div className="flex flex-col gap-7">
              {/* ── Details ── */}
              <div style={{ ...card, padding: '28px 26px 26px' }}>
                <SectionHead step="01" title="Your details" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Field name="Name" text={user.name} />
                  <Field name="Email" text={user.email} />
                  <Field name="Member since" text={user.createdAt ? formatDate(user.createdAt) : '—'} />
                  <Field name="Orders placed" text={orders === null ? '…' : String(orders.length)} />
                </div>
              </div>

              {/* ── Ear fitting ── */}
              <div style={{ ...card, padding: '28px 26px 26px' }}>
                <SectionHead
                  step="02"
                  title="Your ear fitting"
                  note="Where you tapped your earlobes, so earrings sit right on you"
                />
                {user.earCalibration ? (
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center gap-2.5">
                      <span style={{ width: '6px', height: '6px', borderRadius: '999px', background: '#7a8a6f' }} />
                      <span style={{ ...value, fontSize: '13px' }}>
                        Saved
                        {user.earCalibration.calibratedAt
                          ? ` on ${formatDate(user.earCalibration.calibratedAt)}`
                          : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      <LobeReadout title="Your left ear" point={user.earCalibration.screenRight} />
                      <LobeReadout title="Your right ear" point={user.earCalibration.screenLeft} />
                    </div>
                    <button
                      onClick={() => setConfirmReset(true)}
                      className="cursor-pointer self-start"
                      style={pillButton(false)}
                    >
                      Reset Fitting
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 items-start">
                    <p style={{ ...value, fontSize: '13px', color: 'rgba(107,11,20,0.6)', lineHeight: 1.7, maxWidth: '440px' }}>
                      Not set up yet. Open any earrings in Try On Live and tap each earlobe once — we save it
                      here, so you only ever do it once.
                    </p>
                    <button onClick={onBrowse} className="cursor-pointer" style={pillButton(false)}>
                      Try On Earrings
                    </button>
                  </div>
                )}
              </div>

              {/* ── Orders ── */}
              <div style={{ ...card, padding: '28px 26px 26px' }}>
                <SectionHead step="03" title="Your orders" note="Everything you have ordered from us" />
                {orders === null ? (
                  <p style={label}>Loading your orders…</p>
                ) : ordersError ? (
                  <div className="flex flex-col gap-4 items-start">
                    <p style={{ ...value, fontSize: '13px', color: 'rgba(107,11,20,0.6)' }}>
                      We could not load your orders just now.
                    </p>
                    <button onClick={() => void loadOrders()} className="cursor-pointer" style={pillButton(false)}>
                      Try Again
                    </button>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="flex flex-col gap-4 items-start">
                    <p style={{ ...value, fontSize: '13px', color: 'rgba(107,11,20,0.6)' }}>
                      No orders yet. Your first one will appear here.
                    </p>
                    <button onClick={onBrowse} className="cursor-pointer" style={pillButton(false)}>
                      Browse Pieces
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {orders.map((order, i) => (
                      <OrderRow
                        key={order.reference}
                        order={order}
                        last={i === orders.length - 1}
                        open={expanded === order.reference}
                        onToggle={() =>
                          setExpanded((r) => (r === order.reference ? null : order.reference))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Bag ── */}
            <div style={{ ...card, padding: '28px 26px 26px' }} className="relative lg:sticky lg:top-[110px]">
              <CornerMarks />
              <SectionHead step="04" title="Your bag" />
              {!cartReady ? (
                <p style={label}>Loading your bag…</p>
              ) : count === 0 ? (
                <div className="flex flex-col gap-4 items-start">
                  <p style={{ ...value, fontSize: '13px', color: 'rgba(107,11,20,0.6)' }}>
                    Your bag is empty.
                  </p>
                  <button onClick={onBrowse} className="cursor-pointer" style={pillButton(false)}>
                    Browse Pieces
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex items-baseline justify-between">
                    <span style={label}>{count} {count === 1 ? 'piece' : 'pieces'}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-cormorant), serif",
                        fontSize: '26px', color: 'var(--cream-text)', lineHeight: 1,
                      }}
                    >
                      {formatMoney(subtotalMinor)}
                    </span>
                  </div>
                  <span style={{ ...label, letterSpacing: '0.1em', textTransform: 'none', fontSize: '11px' }}>
                    Saved to your account — it will be here on any device you sign in from.
                  </span>
                  <button onClick={onCheckout} className="cursor-pointer" style={pillButton(true)}>
                    Go To Checkout
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmReset}
        title="Reset your ear fitting?"
        message="We will forget where you tapped your earlobes. The next time you try on earrings you will be asked to tap them again."
        confirmLabel="Reset"
        cancelLabel="Keep It"
        destructive
        onConfirm={resetCalibration}
        onCancel={() => setConfirmReset(false)}
      />
    </section>
  );
}

function Field({ name, text }: { name: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span style={label}>{name}</span>
      <span style={{ ...value, overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
    </div>
  );
}

function LobeReadout({ title, point }: { title: string; point: { x: number; y: number; z: number } }) {
  return (
    <div className="flex flex-col gap-1" style={{ borderLeft: '1px solid var(--cream-border)', paddingLeft: '12px' }}>
      <span style={label}>{title}</span>
      <span style={{ ...value, fontSize: '12px', color: 'rgba(107,11,20,0.6)' }}>
        out {point.x.toFixed(1)} · height {point.y.toFixed(1)} · depth {point.z.toFixed(1)} cm
      </span>
    </div>
  );
}

function OrderRow({
  order,
  last,
  open,
  onToggle,
}: {
  order: PastOrder;
  last: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const status = STATUS_COPY[order.status] ?? STATUS_COPY.new;
  const pieces = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--cream-border)' }}>
      <button
        onClick={onToggle}
        className="w-full cursor-pointer flex items-center justify-between gap-4 text-left"
        style={{ background: 'none', border: 'none', padding: '16px 0' }}
        aria-expanded={open}
      >
        <span className="flex flex-col gap-1 min-w-0">
          <span style={{ ...value, fontSize: '13px', letterSpacing: '0.06em' }}>{order.reference}</span>
          <span style={{ ...label, letterSpacing: '0.1em', textTransform: 'none', fontSize: '11px' }}>
            {formatDate(order.createdAt)} · {pieces} {pieces === 1 ? 'piece' : 'pieces'}
          </span>
        </span>
        <span className="flex items-center gap-4 flex-shrink-0">
          <span
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase',
              color: status.color,
            }}
          >
            {status.text}
          </span>
          <span style={{ ...value, fontSize: '14px' }}>{formatMoney(order.totals.totalMinor)}</span>
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="rgba(107,11,20,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 pb-5" style={{ paddingLeft: '2px' }}>
          {order.items.map((item, i) => (
            <div key={`${item.productId}-${i}`} className="flex items-baseline justify-between gap-4">
              <span style={{ ...value, fontSize: '12.5px', color: 'rgba(107,11,20,0.72)' }}>
                {item.productName} × {item.quantity}
              </span>
              <span style={{ ...value, fontSize: '12.5px', color: 'rgba(107,11,20,0.72)' }}>
                {formatMoney(item.lineTotalMinor)}
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 pt-2" style={{ borderTop: '1px solid var(--cream-border)' }}>
            <span style={label}>Delivery</span>
            <span style={{ ...value, fontSize: '12.5px' }}>
              {order.totals.deliveryMinor === 0 ? 'Complimentary' : formatMoney(order.totals.deliveryMinor)}
            </span>
          </div>
          <div className="flex flex-col gap-1 pt-1">
            <span style={label}>Delivered to</span>
            <span style={{ ...value, fontSize: '12.5px', color: 'rgba(107,11,20,0.72)', lineHeight: 1.6 }}>
              {order.shipping.address}, {order.shipping.city} {order.shipping.postalCode}, {order.shipping.country}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
