'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api, ApiError, AdminProduct, AdminProductList,
  PRODUCT_STATUSES, ProductStatus,
} from '@/lib/api';
import { formatMoney } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import ProductForm from '@/components/admin/ProductForm';
import { Card, Empty, SearchInput, Pager, GOLD, longDate } from '@/components/admin/ui';

const PER_PAGE = 12;

const TONE: Record<ProductStatus, { bg: string; fg: string; note: string }> = {
  active: { bg: 'rgba(120,150,110,0.22)', fg: '#3a5334', note: 'On sale in the shop' },
  hidden: { bg: 'rgba(194,160,106,0.22)', fg: '#6b5427', note: 'Taken off the shop for now' },
  archived: { bg: 'rgba(28,36,56,0.09)', fg: '#5a6178', note: 'Retired — kept for past orders' },
};

function StatusChip({ status }: { status: ProductStatus }) {
  const tone = TONE[status];
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wide whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg }}
      title={tone.note}
    >
      {status}
    </span>
  );
}

export default function CataloguePage() {
  const { toast } = useToast();
  const [data, setData] = useState<AdminProductList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
      if (search) params.set('q', search);
      if (status !== 'all') params.set('status', status);
      setData(await api.get<AdminProductList>(`/api/admin/products?${params}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the catalogue');
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => { void load(); }, [load]);

  const setProductStatus = async (product: AdminProduct, next: ProductStatus) => {
    setBusy(product.id);
    try {
      await api.patch(`/api/admin/products/${product.id}`, { status: next });
      toast({ kind: 'info', title: `${product.name} is now ${next}` });
      await load();
    } catch (err) {
      toast({
        kind: 'error',
        title: 'Could not change that',
        message: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const product = deleting;
    setDeleting(null);
    setBusy(product.id);
    try {
      await api.del(`/api/admin/products/${product.id}`);
      toast({ kind: 'info', title: `${product.name} deleted` });
      await load();
    } catch (err) {
      // The server refuses to delete anything that has sold, and says why.
      toast({
        kind: 'error',
        title: 'Not deleted',
        message: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (product: AdminProduct) => { setEditing(product); setFormOpen(true); };

  const tabs: Array<ProductStatus | 'all'> = ['all', ...PRODUCT_STATUSES];
  const counts = data?.counts ?? {};

  const action = (label: string, onClick: () => void, disabled: boolean) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-xs underline transition disabled:opacity-40 disabled:cursor-default disabled:no-underline"
      style={{ color: 'var(--admin-muted)' }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search pieces" />
        <button
          onClick={openNew}
          className="rounded-lg px-5 py-2.5 text-sm transition"
          style={{ background: 'var(--admin-rail)', color: '#f4efe6' }}
        >
          Add a piece
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const on = status === tab;
          return (
            <button
              key={tab}
              onClick={() => { setStatus(tab); setPage(1); }}
              className="rounded-full px-4 py-1.5 text-sm capitalize transition"
              style={{
                background: on ? 'var(--admin-rail)' : '#ffffff',
                color: on ? '#f4efe6' : 'var(--admin-ink)',
                border: '1px solid var(--admin-line)',
              }}
            >
              {tab}
              <span className="ml-1.5" style={{ color: on ? 'rgba(244,239,230,0.6)' : 'var(--admin-muted)' }}>
                {counts[tab] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm" style={{ color: '#d03b3b' }}>{error}</p>}

      {data && !data.uploadsEnabled && (
        <p
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(194,160,106,0.12)', color: '#6b5427', border: '1px solid rgba(194,160,106,0.3)' }}
        >
          Image uploads are switched off — add your Cloudinary keys to the server&rsquo;s <code>.env</code> to
          turn them on. Pieces can still be added without a photo.
        </p>
      )}

      <Card>
        {loading && !data ? (
          <Empty>Loading the catalogue…</Empty>
        ) : !data?.products.length ? (
          <Empty>
            {search || status !== 'all'
              ? 'Nothing matches that.'
              : 'No pieces added yet. Use “Add a piece” to put one in the shop.'}
          </Empty>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.products.map((p) => (
              <div
                key={p.id}
                className="flex flex-col rounded-xl overflow-hidden transition"
                style={{
                  border: '1px solid var(--admin-line)',
                  opacity: busy === p.id ? 0.5 : p.status === 'active' ? 1 : 0.72,
                }}
              >
                <div className="relative grid aspect-square place-items-center" style={{ background: '#f6f5f3' }}>
                  {p.image ? (
                    <img src={p.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span
                      className="font-cormorant leading-none select-none"
                      style={{ fontSize: 64, color: 'rgba(28,36,56,0.12)' }}
                    >
                      {p.name.charAt(0)}
                    </span>
                  )}
                  <span className="absolute top-2.5 left-2.5">
                    <StatusChip status={p.status} />
                  </span>
                </div>

                <div className="flex flex-1 flex-col gap-1 px-4 pt-3.5 pb-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="truncate text-sm" style={{ color: 'var(--admin-ink)' }}>{p.name}</h3>
                    <span
                      className="shrink-0 text-sm"
                      style={{ color: 'var(--admin-ink)', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatMoney(p.priceMinor)}
                    </span>
                  </div>

                  <p className="truncate text-xs capitalize" style={{ color: 'var(--admin-muted)' }}>
                    {p.category}
                    {p.description && ` · ${p.description}`}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--admin-muted)' }}>
                    Added {longDate(p.createdAt)}
                  </p>

                  <div
                    className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-2 pt-3"
                    style={{ borderTop: '1px solid var(--admin-line)' }}
                  >
                    <button
                      onClick={() => openEdit(p)}
                      disabled={busy === p.id}
                      className="text-xs underline disabled:opacity-40"
                      style={{ color: GOLD }}
                    >
                      Edit
                    </button>

                    {p.status === 'active'
                      ? action('Hide', () => void setProductStatus(p, 'hidden'), busy === p.id)
                      : action('Show in shop', () => void setProductStatus(p, 'active'), busy === p.id)}

                    {p.status === 'archived'
                      ? action('Restore', () => void setProductStatus(p, 'hidden'), busy === p.id)
                      : action('Archive', () => void setProductStatus(p, 'archived'), busy === p.id)}

                    <button
                      onClick={() => setDeleting(p)}
                      disabled={busy === p.id}
                      className="text-xs underline disabled:opacity-40"
                      style={{ color: '#d03b3b' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {data && (
        <Pager
          page={data.page}
          pages={data.pages}
          total={data.total}
          limit={data.limit}
          noun="pieces"
          onPage={setPage}
        />
      )}

      {formOpen && (
        <ProductForm
          editing={editing}
          uploadsEnabled={data?.uploadsEnabled ?? false}
          onClose={() => setFormOpen(false)}
          onSaved={(message) => {
            setFormOpen(false);
            toast({ kind: 'success', title: message });
            void load();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? 'this piece'}?`}
        message="This removes it and its photo for good. If it has ever been ordered, archive it instead so the order history still reads properly."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
