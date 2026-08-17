'use client';

import { useMemo, useState } from 'react';
import { AdminStats, ORDER_STATUSES } from '@/lib/api';
import { formatMoney } from '@/context/CartContext';


const SERIES = '#a3323f';
const TRACK = '#f0e4e5';
const GRID = '#e8e6e2';
const UP = '#006300';
const DOWN = '#d03b3b';

function pct(now: number, before: number): number | null {
  if (!before) return now ? 100 : null;
  return Math.round(((now - before) / before) * 100);
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function AdminDashboard({ stats }: { stats: AdminStats }) {
  const { revenue, orders, customers, perDay, topPieces, recentCustomers } = stats;

  return (
    <div className="flex flex-col gap-4 mb-10">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Revenue, last 30 days"
          value={formatMoney(revenue.last30Minor)}
          delta={pct(revenue.last30Minor, revenue.prev30Minor)}
        />
        <StatTile
          label="Orders, last 30 days"
          value={orders.last30.toLocaleString()}
          delta={pct(orders.last30, orders.prev30)}
        />
        <StatTile
          label="Registered customers"
          value={customers.total.toLocaleString()}
          delta={pct(customers.last30, customers.prev30)}
          note={`${customers.withOrders} have ordered`}
        />
        <StatTile
          label="Average order"
          value={formatMoney(revenue.avgOrderMinor)}
          note={`${orders.total} orders all time · ${formatMoney(revenue.allTimeMinor)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Orders per day" subtitle="Last 30 days">
          <DailyOrders perDay={perDay} />
        </Card>
        <Card title="Order pipeline" subtitle={`${orders.total} total`}>
          <Pipeline byStatus={orders.byStatus} total={orders.total} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Best selling pieces" subtitle="By units sold, all time">
          <TopPieces pieces={topPieces} />
        </Card>
        <Card title="Newest customers" subtitle={`${customers.total} registered`}>
          <RecentCustomers customers={recentCustomers} />
        </Card>
      </div>
    </div>
  );
}

function Card({
  title, subtitle, children, className = '',
}: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-xl px-5 py-4 ${className}`}
      style={{ border: '1px solid var(--cream-border)', background: '#f9f9f9' }}
    >
      <h2 className="text-sm font-medium" style={{ color: 'var(--cream-text)' }}>{title}</h2>
      {subtitle && (
        <p className="text-xs mb-4" style={{ color: 'var(--cream-muted)' }}>{subtitle}</p>
      )}
      {children}
    </section>
  );
}

function StatTile({
  label, value, delta, note,
}: { label: string; value: string; delta?: number | null; note?: string }) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{ border: '1px solid var(--cream-border)', background: '#f9f9f9' }}
    >
      <p className="text-xs mb-1" style={{ color: 'var(--cream-muted)' }}>{label}</p>
      <p className="text-2xl font-semibold leading-tight" style={{ color: 'var(--cream-text)' }}>
        {value}
      </p>
      {delta !== undefined && delta !== null && (
        <p className="text-xs mt-1" style={{ color: delta >= 0 ? UP : DOWN }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs previous 30 days
        </p>
      )}
      {note && <p className="text-xs mt-1" style={{ color: 'var(--cream-muted)' }}>{note}</p>}
    </div>
  );
}

function TableToggle({ showing, onClick }: { showing: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs underline mt-3"
      style={{ color: 'var(--cream-muted)' }}
    >
      {showing ? 'Show chart' : 'Show table'}
    </button>
  );
}

function Tick({ value, top }: { value: number; top: string }) {
  return (
    <span
      className="absolute -left-1 text-[10px] px-1"
      style={{ top, color: 'var(--cream-muted)', background: '#f9f9f9', fontVariantNumeric: 'tabular-nums' }}
    >
      {value}
    </span>
  );
}

function DailyOrders({ perDay }: { perDay: AdminStats['perDay'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = useMemo(() => Math.max(1, ...perDay.map((d) => d.orders)), [perDay]);
  const peak = useMemo(() => perDay.reduce((b, d, i) => (d.orders > perDay[b].orders ? i : b), 0), [perDay]);
  const busy = perDay.some((d) => d.orders > 0);

  if (table) {
    return (
      <>
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full text-xs" style={{ color: 'var(--cream-text)' }}>
            <thead>
              <tr style={{ color: 'var(--cream-muted)' }}>
                <th className="text-left font-normal pb-1">Date</th>
                <th className="text-right font-normal pb-1">Orders</th>
                <th className="text-right font-normal pb-1">Revenue</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
              {perDay.map((d) => (
                <tr key={d.date}>
                  <td className="py-0.5">{shortDate(d.date)}</td>
                  <td className="text-right">{d.orders}</td>
                  <td className="text-right">{formatMoney(d.revenueMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TableToggle showing onClick={() => setTable(false)} />
      </>
    );
  }

  if (!busy) {
    return (
      <>
        <p className="text-sm py-10 text-center" style={{ color: 'var(--cream-muted)' }}>
          No orders in the last 30 days.
        </p>
        <TableToggle showing={false} onClick={() => setTable(true)} />
      </>
    );
  }

  return (
    <>
      <div className="relative">
        {hover !== null && (
          <div
            className="absolute -top-1 z-10 rounded-lg px-3 py-2 text-xs pointer-events-none whitespace-nowrap"
            style={{
              left: `${(hover / perDay.length) * 100}%`,
              transform: hover > perDay.length / 2 ? 'translateX(-100%)' : 'none',
              background: '#ffffff', border: '1px solid var(--cream-border)',
              boxShadow: '0 6px 18px rgba(60,50,35,0.12)', color: 'var(--cream-text)',
            }}
          >
            <strong>{shortDate(perDay[hover].date)}</strong>
            <br />
            {perDay[hover].orders} {perDay[hover].orders === 1 ? 'order' : 'orders'}
            <br />
            {formatMoney(perDay[hover].revenueMinor)}
          </div>
        )}

        <div className="relative" style={{ height: 140 }}>
          <div className="absolute inset-x-0 top-0" style={{ borderTop: `1px solid ${GRID}` }} />
          <div className="absolute inset-x-0 bottom-0" style={{ borderTop: `1px solid var(--cream-border)` }} />
          <Tick value={max} top="-8px" />
          {/* A midline only once it lands on a whole order — 1.5 orders means nothing. */}
          {max >= 4 && (
            <>
              <div className="absolute inset-x-0" style={{ top: '50%', borderTop: `1px solid ${GRID}` }} />
              <Tick value={Math.round(max / 2)} top="calc(50% - 8px)" />
            </>
          )}

          <div className="flex items-end gap-[2px] h-full">
            {perDay.map((d, i) => (
              <div
                key={d.date}
                className="flex-1 h-full flex items-end justify-center cursor-default"
                style={{ maxWidth: 24 }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${(d.orders / max) * 100}%`,
                    minHeight: d.orders ? 2 : 0,
                    background: SERIES,
                    opacity: hover === null || hover === i ? 1 : 0.55,
                    borderRadius: '4px 4px 0 0',
                    transition: 'opacity 120ms',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-1 text-[10px]" style={{ color: 'var(--cream-muted)' }}>
          <span>{shortDate(perDay[0].date)}</span>
          <span>peak {perDay[peak].orders} on {shortDate(perDay[peak].date)}</span>
          <span>{shortDate(perDay[perDay.length - 1].date)}</span>
        </div>
      </div>
      <TableToggle showing={false} onClick={() => setTable(true)} />
    </>
  );
}

function Pipeline({
  byStatus, total,
}: { byStatus: Record<string, number>; total: number }) {
  return (
    <div className="flex flex-col gap-3">
      {ORDER_STATUSES.map((s) => {
        const n = byStatus[s] ?? 0;
        return (
          <div key={s}>
            <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--cream-text)' }}>
              <span className="capitalize">{s}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: TRACK }}>
              <div
                className="h-full rounded-full"
                style={{ width: total ? `${(n / total) * 100}%` : '0%', background: SERIES }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TopPieces({ pieces }: { pieces: AdminStats['topPieces'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(1, ...pieces.map((p) => p.units)), [pieces]);

  if (!pieces.length) {
    return <p className="text-sm py-8 text-center" style={{ color: 'var(--cream-muted)' }}>Nothing sold yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {pieces.map((p, i) => (
        <div
          key={p.productId}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex justify-between text-sm mb-1 gap-3" style={{ color: 'var(--cream-text)' }}>
            <span className="truncate">{p.name}</span>
            <span className="shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {p.units} sold
              <span style={{ color: 'var(--cream-muted)' }}> · {formatMoney(p.revenueMinor)}</span>
            </span>
          </div>
          <div className="h-2.5">
            <div
              className="h-full"
              style={{
                width: `${(p.units / max) * 100}%`,
                background: SERIES,
                borderRadius: '0 4px 4px 0',
                opacity: hover === null || hover === i ? 1 : 0.55,
                transition: 'opacity 120ms',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecentCustomers({ customers }: { customers: AdminStats['recentCustomers'] }) {
  if (!customers.length) {
    return <p className="text-sm py-8 text-center" style={{ color: 'var(--cream-muted)' }}>No one has registered yet.</p>;
  }
  return (
    <table className="w-full text-sm" style={{ color: 'var(--cream-text)' }}>
      <thead>
        <tr className="text-xs" style={{ color: 'var(--cream-muted)' }}>
          <th className="text-left font-normal pb-2">Name</th>
          <th className="text-left font-normal pb-2">Joined</th>
          <th className="text-right font-normal pb-2">Orders</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((c) => (
          <tr key={c.email} style={{ borderTop: '1px solid var(--cream-border)' }}>
            <td className="py-2 pr-2">
              <span className="block truncate">{c.name}</span>
              <span className="block truncate text-xs" style={{ color: 'var(--cream-muted)' }}>{c.email}</span>
            </td>
            <td className="py-2 text-xs whitespace-nowrap" style={{ color: 'var(--cream-muted)' }}>
              {new Date(c.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
            </td>
            <td className="py-2 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.orders}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
