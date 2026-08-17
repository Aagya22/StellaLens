'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api, ApiError, ORDER_STATUSES,
  AdminOrderList, AdminOrderRow, AdminOrderDetail, OrderStatus,
} from '@/lib/api';
import { formatMoney } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import {
  Card, Empty, SearchInput, Pager, StatusChip, STATUS_TONE, longDate,
} from '@/components/admin/ui';

export default function OrdersPage() {
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

  useEffect(() => {
    const t = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
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
  }, [status, search, page]);

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

  const counts = data?.counts ?? {};
  const tabs: Array<OrderStatus | 'all'> = ['all', ...ORDER_STATUSES];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = status === t;
            return (
              <button
                key={t}
                onClick={() => { setStatus(t); setPage(1); }}
                className="rounded-full px-4 py-1.5 text-sm capitalize transition"
                style={{
                  background: active ? 'var(--admin-rail)' : '#ffffff',
                  color: active ? '#fdf6ee' : 'var(--admin-ink)',
                  border: '1px solid var(--admin-line)',
                }}
              >
                {t}{counts[t] !== undefined ? ` (${counts[t]})` : ''}
              </button>
            );
          })}
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search reference, name or email" />
      </div>

      {error && <p className="text-sm" style={{ color: '#d03b3b' }}>{error}</p>}

      {loading && !data ? (
        <Empty>Loading orders…</Empty>
      ) : !data?.orders.length ? (
        <Card>
          <Empty>{search || status !== 'all' ? 'No orders match that.' : 'No orders yet.'}</Empty>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
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

      {data && <Pager page={data.page} pages={data.pages} total={data.total} limit={data.limit} noun="orders" onPage={setPage} />}
    </div>
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
      className="rounded-2xl overflow-hidden"
      style={{ background: '#ffffff', border: '1px solid var(--admin-line)' }}
    >
      <button onClick={onToggle} className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left">
        <span className="font-mono text-sm" style={{ color: 'var(--admin-ink)' }}>{row.reference}</span>
        <StatusChip status={row.status} />
        <span className="text-sm" style={{ color: 'var(--admin-ink)' }}>{row.customerName}</span>
        <span className="text-sm ml-auto" style={{ color: 'var(--admin-muted)' }}>
          {row.itemCount} {row.itemCount === 1 ? 'item' : 'items'}
        </span>
        <span className="text-sm font-medium" style={{ color: 'var(--admin-ink)' }}>
          {formatMoney(row.totalMinor)}
        </span>
        <span className="text-xs w-full" style={{ color: 'var(--admin-muted)' }}>{longDate(row.createdAt)}</span>
      </button>

      {open && (
        <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--admin-line)' }}>
          {detailLoading || !detail ? (
            <p className="py-4 text-sm" style={{ color: 'var(--admin-muted)' }}>Loading…</p>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 py-4 text-sm" style={{ color: 'var(--admin-ink)' }}>
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
                    <p className="mt-2 italic" style={{ color: 'var(--admin-muted)' }}>“{detail.shipping.notes}”</p>
                  )}
                </div>
              </div>

              <Heading>Items</Heading>
              <div className="flex flex-col gap-1 py-2 text-sm" style={{ color: 'var(--admin-ink)' }}>
                {detail.items.map((item, i) => (
                  <div key={`${item.productId}-${i}`} className="flex justify-between gap-4">
                    <span>
                      {item.productName} × {item.quantity}
                      {item.customizations && Object.values(item.customizations).some(Boolean) && (
                        <span style={{ color: 'var(--admin-muted)' }}>
                          {' '}· {Object.entries(item.customizations).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </span>
                      )}
                    </span>
                    <span>{formatMoney(item.lineTotalMinor)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-4" style={{ color: 'var(--admin-muted)' }}>
                  <span>Delivery</span>
                  <span>{detail.totals.deliveryMinor === 0 ? 'Free' : formatMoney(detail.totals.deliveryMinor)}</span>
                </div>
                <div className="flex justify-between gap-4 font-medium pt-1">
                  <span>Total</span>
                  <span>{formatMoney(detail.totals.totalMinor)}</span>
                </div>
              </div>

              <div className="pt-3">
                <Heading>Move to</Heading>
                <div className="flex flex-wrap gap-2 pt-1">
                  {ORDER_STATUSES.map((s) => (
                    <button
                      key={s}
                      disabled={saving || s === detail.status}
                      onClick={() => onStatus(s)}
                      className="rounded-full px-4 py-1.5 text-sm capitalize transition disabled:opacity-45 disabled:cursor-default"
                      style={{
                        background: s === detail.status ? STATUS_TONE[s].bg : '#ffffff',
                        color: s === detail.status ? STATUS_TONE[s].fg : 'var(--admin-ink)',
                        border: '1px solid var(--admin-line)',
                      }}
                    >
                      {s === detail.status ? `${s} (current)` : s}
                    </button>
                  ))}
                </div>
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
    <p className="text-[11px] uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--admin-muted)' }}>
      {children}
    </p>
  );
}
