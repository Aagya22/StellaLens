'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, AdminPiece } from '@/lib/api';
import { formatMoney } from '@/context/CartContext';
import { Card, Empty, StatTile, BarRow } from '@/components/admin/ui';

const CATEGORIES = ['all', 'earrings', 'necklaces', 'rings', 'bracelets'] as const;

export default function PiecesPage() {
  const [pieces, setPieces] = useState<AdminPiece[] | null>(null);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');

  useEffect(() => {
    api.get<{ pieces: AdminPiece[] }>('/api/admin/pieces')
      .then((r) => setPieces(r.pieces))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load pieces'));
  }, []);

  const shown = useMemo(
    () => (pieces ?? []).filter((p) => category === 'all' || p.category === category),
    [pieces, category]
  );
  const maxUnits = Math.max(1, ...shown.map((p) => p.units));
  const sold = (pieces ?? []).filter((p) => p.units > 0);
  const never = (pieces ?? []).filter((p) => p.units === 0);
  const best = sold[0];

  if (error) return <Empty>{error}</Empty>;
  if (!pieces) return <Empty>Loading…</Empty>;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Pieces in catalogue" value={String(pieces.length)} note={`${sold.length} have sold`} />
        <StatTile label="Never ordered" value={String(never.length)} note={never.length ? 'Worth a second look' : 'Everything has sold'} />
        <StatTile
          label="Best seller"
          value={best ? `${best.units}` : '—'}
          note={best ? `${best.name} · ${formatMoney(best.revenueMinor)}` : 'Nothing sold yet'}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="rounded-full px-4 py-1.5 text-sm capitalize transition"
              style={{
                background: active ? 'var(--admin-rail)' : '#ffffff',
                color: active ? '#fdf6ee' : 'var(--admin-ink)',
                border: '1px solid var(--admin-line)',
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      <Card title="Units sold" subtitle="All time, cancelled orders excluded">
        {!shown.length ? (
          <Empty>No pieces in this category.</Empty>
        ) : (
          <div className="flex flex-col gap-3.5">
            {shown.map((p) => (
              <BarRow
                key={p.productId}
                label={p.name}
                value={p.units ? `${p.units} sold` : 'none sold'}
                sub={p.units ? formatMoney(p.revenueMinor) : formatMoney(p.priceMinor)}
                fraction={p.units / maxUnits}
                dim={p.units === 0}
              />
            ))}
          </div>
        )}
      </Card>

      <Card title="Every piece" subtitle="Catalogue price against what it has actually earned">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ color: 'var(--admin-ink)' }}>
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--admin-muted)' }}>
                <th className="text-left font-normal pb-2.5">Piece</th>
                <th className="text-left font-normal pb-2.5">Category</th>
                <th className="text-right font-normal pb-2.5">Price</th>
                <th className="text-right font-normal pb-2.5">Units</th>
                <th className="text-right font-normal pb-2.5">Orders</th>
                <th className="text-right font-normal pb-2.5">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.productId} style={{ borderTop: '1px solid var(--admin-line)' }}>
                  <td className="py-3 pr-4">{p.name}</td>
                  <td className="py-3 pr-4 text-xs capitalize" style={{ color: 'var(--admin-muted)' }}>{p.category}</td>
                  <td className="py-3 pr-4 text-right whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(p.priceMinor)}
                  </td>
                  <td className="py-3 pr-4 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.units}</td>
                  <td className="py-3 pr-4 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{p.orders}</td>
                  <td className="py-3 text-right whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {p.revenueMinor ? formatMoney(p.revenueMinor) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
