'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, AdminStats, ORDER_STATUSES } from '@/lib/api';
import { formatMoney } from '@/context/CartContext';
import {
  Card, StatTile, Empty, BarRow, DailyOrders, pct, longDate,
} from '@/components/admin/ui';

export default function OverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<AdminStats>('/api/admin/stats')
      .then(setStats)
      .catch((e) => setError(e?.message ?? 'Could not load the dashboard'));
  }, []);

  if (error) return <Empty>{error}</Empty>;
  if (!stats) return <Empty>Loading…</Empty>;

  const { revenue, orders, customers, perDay, topPieces, recentCustomers } = stats;
  const maxUnits = Math.max(1, ...topPieces.map((p) => p.units));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Revenue · 30 days"
          value={formatMoney(revenue.last30Minor)}
          delta={pct(revenue.last30Minor, revenue.prev30Minor)}
        />
        <StatTile
          label="Orders · 30 days"
          value={orders.last30.toLocaleString()}
          delta={pct(orders.last30, orders.prev30)}
        />
        <StatTile
          label="Customers"
          value={customers.total.toLocaleString()}
          delta={pct(customers.last30, customers.prev30)}
          note={`${customers.withOrders} have ordered`}
        />
        <StatTile
          label="Average order"
          value={formatMoney(revenue.avgOrderMinor)}
          note={`${orders.total} all time · ${formatMoney(revenue.allTimeMinor)}`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Orders per day" subtitle="Last 30 days">
          <DailyOrders perDay={perDay} formatMoney={formatMoney} />
        </Card>

        <Card
          title="Pipeline"
          subtitle={`${orders.total} orders total`}
          action={<Link href="/admin/orders" className="text-xs underline" style={{ color: 'var(--admin-muted)' }}>Open</Link>}
        >
          <div className="flex flex-col gap-3.5">
            {ORDER_STATUSES.map((s) => (
              <BarRow
                key={s}
                label={s[0].toUpperCase() + s.slice(1)}
                value={String(orders.byStatus[s] ?? 0)}
                fraction={orders.total ? (orders.byStatus[s] ?? 0) / orders.total : 0}
              />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card
          title="Best selling pieces"
          subtitle="By units sold, all time"
          action={<Link href="/admin/pieces" className="text-xs underline" style={{ color: 'var(--admin-muted)' }}>All pieces</Link>}
        >
          {!topPieces.length ? (
            <Empty>Nothing sold yet.</Empty>
          ) : (
            <div className="flex flex-col gap-3.5">
              {topPieces.map((p) => (
                <BarRow
                  key={p.productId}
                  label={p.name}
                  value={`${p.units} sold`}
                  sub={formatMoney(p.revenueMinor)}
                  fraction={p.units / maxUnits}
                />
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Newest customers"
          subtitle={`${customers.total} registered`}
          action={<Link href="/admin/customers" className="text-xs underline" style={{ color: 'var(--admin-muted)' }}>All customers</Link>}
        >
          {!recentCustomers.length ? (
            <Empty>No one has registered yet.</Empty>
          ) : (
            <table className="w-full text-sm" style={{ color: 'var(--admin-ink)' }}>
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--admin-muted)' }}>
                  <th className="text-left font-normal pb-2">Name</th>
                  <th className="text-left font-normal pb-2">Joined</th>
                  <th className="text-right font-normal pb-2">Orders</th>
                </tr>
              </thead>
              <tbody>
                {recentCustomers.map((c) => (
                  <tr key={c.email} style={{ borderTop: '1px solid var(--admin-line)' }}>
                    <td className="py-2.5 pr-2 min-w-0">
                      <span className="block truncate">{c.name}</span>
                      <span className="block truncate text-xs" style={{ color: 'var(--admin-muted)' }}>{c.email}</span>
                    </td>
                    <td className="py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--admin-muted)' }}>
                      {longDate(c.createdAt)}
                    </td>
                    <td className="py-2.5 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
