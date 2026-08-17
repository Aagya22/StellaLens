'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api, ApiError, ORDER_STATUSES,
  AdminOrderList, AdminOrderRow, AdminOrderDetail, OrderStatus,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';

const STATUS_TONE: Record<OrderStatus, { bg: string; fg: string }> = {
  new: { bg: 'rgba(107,11,20,0.10)', fg: 'var(--rose-deep)' },
  contacted: { bg: 'rgba(179,146,94,0.18)', fg: 'var(--gold-ink)' },
  fulfilled: { bg: 'rgba(169,184,161,0.30)', fg: 'var(--sage-ink)' },
  cancelled: { bg: 'rgba(18,22,43,0.10)', fg: 'var(--navy-fade)' },
};

function StatusChip({ status }: { status: OrderStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] tracking-wide uppercase"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<AdminOrderList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [openRef, setOpenRef] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const t = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'all') params.set('status', status);
      if (search) params.set('q', search);
      setData(await api.get<AdminOrderList>(`/api/admin/orders?${params}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, status, search, page]);

  useEffect(() => { void load(); }, [load]);

  const openOrder = async (reference: string) => {
    if (openRef === reference) { setOpenRef(null); setDetail(null); return; }
    setOpenRef(reference);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.get<{ order: AdminOrderDetail }>(`/api/admin/orders/${reference}`);
      setDetail(res.order);
    } catch (err) {
      toast({ kind: 'error', title: 'Could not open that order', message: err instanceof ApiError ? err.message : '' });
      setOpenRef(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (reference: string, next: OrderStatus) => {
    setSaving(true);
    try {
      const res = await api.patch<{ order: AdminOrderDetail }>(
        `/api/admin/orders/${reference}/status`, { status: next }
      );
      setDetail(res.order);
      toast({ kind: 'success', title: 'Order updated', message: `${reference} is now ${next}.` });
      await load();
    } catch (err) {
      toast({ kind: 'error', title: 'Could not update', message: err instanceof ApiError ? err.message : '' });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return <Shell><p style={{ color: 'var(--cream-muted)' }}>Checking your access…</p></Shell>;
  }

  if (!isAdmin) {
    return (
      <Shell>
        <h1 className="font-cormorant text-3xl mb-3" style={{ color: 'var(--cream-text)' }}>
          Not available
        </h1>
        <p className="mb-6" style={{ color: 'var(--cream-muted)' }}>
          This page is for StellaLens staff.
        </p>
        <Link href="/" className="underline" style={{ color: 'var(--gold-bright)' }}>
          Back to the shop
        </Link>
      </Shell>
    );
  }

  const counts = data?.counts ?? {};
  const tabs: Array<OrderStatus | 'all'> = ['all', ...ORDER_STATUSES];

  return (
    <Shell wide>
      <div className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
        <h1 className="font-cormorant text-4xl font-semibold" style={{ color: 'var(--cream-text)' }}>
          Orders
        </h1>
        <Link href="/" className="text-sm underline" style={{ color: 'var(--gold-bright)' }}>
          Back to the shop
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((t) => {
          const active = status === t;
          return (
            <button
              key={t}
              onClick={() => { setStatus(t); setPage(1); }}
              className="rounded-full px-4 py-1.5 text-sm transition"
              style={{
                background: active ? 'var(--cream-text)' : 'transparent',
                color: active ? '#ffffff' : 'var(--cream-text)',
                border: '1px solid var(--cream-border)',
              }}
            >
              {t}{counts[t] !== undefined ? ` (${counts[t]})` : ''}
            </button>
          );
        })}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search reference, name or email"
        className="w-full md:w-96 mb-6 rounded-lg px-4 py-2 text-sm outline-none"
        style={{ border: '1px solid var(--cream-border)', color: 'var(--cream-text)' }}
      />

      {error && (
        <p className="mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</p>
      )}

      {loading && !data ? (
        <p style={{ color: 'var(--cream-muted)' }}>Loading orders…</p>
      ) : !data?.orders.length ? (
        <p style={{ color: 'var(--cream-muted)' }}>
          {search || status !== 'all' ? 'No orders match that.' : 'No orders yet.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {data.orders.map((row) => (
            <OrderRow
              key={row.reference}
              row={row}
              open={openRef === row.reference}
              detail={openRef === row.reference ? detail : null}
              detailLoading={openRef === row.reference && detailLoading}
              saving={saving}
              onToggle={() => void openOrder(row.reference)}
              onStatus={(next) => void changeStatus(row.reference, next)}
            />
          ))}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center gap-4 mt-6 text-sm" style={{ color: 'var(--cream-text)' }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="underline disabled:opacity-30"
          >
            Previous
          </button>
          <span style={{ color: 'var(--cream-muted)' }}>
            Page {data.page} of {data.pages} · {data.total} orders
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
            className="underline disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-screen px-6 py-12" style={{ background: 'var(--cream)' }}>
      <div className={wide ? 'mx-auto max-w-5xl' : 'mx-auto max-w-xl'}>{children}</div>
    </main>
  );
}

function OrderRow({
  row, open, detail, detailLoading, saving, onToggle, onStatus,
}: {
  row: AdminOrderRow;
  open: boolean;
  detail: AdminOrderDetail | null;
  detailLoading: boolean;
  saving: boolean;
  onToggle: () => void;
  onStatus: (next: OrderStatus) => void;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--cream-border)', background: 'var(--cream-dark)' }}
    >
      <button
        onClick={onToggle}
        className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left"
      >
        <span className="font-mono text-sm" style={{ color: 'var(--cream-text)' }}>
          {row.reference}
        </span>
        <StatusChip status={row.status} />
        <span className="text-sm" style={{ color: 'var(--cream-text)' }}>{row.customerName}</span>
        <span className="text-sm ml-auto" style={{ color: 'var(--cream-muted)' }}>
          {row.itemCount} {row.itemCount === 1 ? 'item' : 'items'}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--cream-text)' }}>
          {formatMoney(row.totalMinor)}
        </span>
        <span className="text-xs w-full" style={{ color: 'var(--cream-muted)' }}>
          {formatDate(row.createdAt)}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1" style={{ borderTop: '1px solid var(--cream-border)' }}>
          {detailLoading || !detail ? (
            <p className="py-3 text-sm" style={{ color: 'var(--cream-muted)' }}>Loading…</p>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 py-4 text-sm" style={{ color: 'var(--cream-text)' }}>
                <div>
                  <Heading>Customer</Heading>
                  <p>{detail.customer.name}</p>
                  <p><a className="underline" href={`mailto:${detail.customer.email}`}>{detail.customer.email}</a></p>
                  <p><a className="underline" href={`tel:${detail.customer.phone}`}>{detail.customer.phone}</a></p>
                </div>
                <div>
                  <Heading>Deliver to</Heading>
                  <p>{detail.shipping.address}</p>
                  <p>{detail.shipping.city} {detail.shipping.postalCode}</p>
                  <p>{detail.shipping.country}</p>
                  {detail.shipping.notes && (
                    <p className="mt-2 italic" style={{ color: 'var(--cream-muted)' }}>
                      “{detail.shipping.notes}”
                    </p>
                  )}
                </div>
              </div>

              <Heading>Items</Heading>
              <div className="flex flex-col gap-1 py-2 text-sm" style={{ color: 'var(--cream-text)' }}>
                {detail.items.map((item, i) => (
                  <div key={`${item.productId}-${i}`} className="flex justify-between gap-4">
                    <span>
                      {item.productName} × {item.quantity}
                      {item.customizations && Object.values(item.customizations).some(Boolean) && (
                        <span style={{ color: 'var(--cream-muted)' }}>
                          {' '}· {Object.entries(item.customizations)
                            .filter(([, v]) => v)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')}
                        </span>
                      )}
                    </span>
                    <span>{formatMoney(item.lineTotalMinor)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-4" style={{ color: 'var(--cream-muted)' }}>
                  <span>Delivery</span>
                  <span>{detail.totals.deliveryMinor === 0 ? 'Free' : formatMoney(detail.totals.deliveryMinor)}</span>
                </div>
                <div className="flex justify-between gap-4 font-medium pt-1">
                  <span>Total</span>
                  <span>{formatMoney(detail.totals.totalMinor)}</span>
                </div>
              </div>

              <Heading>Move to</Heading>
              <div className="flex flex-wrap gap-2 pt-1">
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s}
                    disabled={saving || s === detail.status}
                    onClick={() => onStatus(s)}
                    className="rounded-full px-4 py-1.5 text-sm transition disabled:opacity-40 disabled:cursor-default"
                    style={{
                      background: s === detail.status ? STATUS_TONE[s].bg : 'transparent',
                      color: s === detail.status ? STATUS_TONE[s].fg : 'var(--cream-text)',
                      border: '1px solid var(--cream-border)',
                    }}
                  >
                    {s === detail.status ? `${s} (current)` : s}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--gold-bright)' }}>
      {children}
    </p>
  );
}
