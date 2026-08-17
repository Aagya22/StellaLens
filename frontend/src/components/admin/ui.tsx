'use client';

import { useMemo, useState } from 'react';
import { OrderStatus } from '@/lib/api';

export const SERIES = '#a3323f';
export const TRACK = '#f2e6e7';
export const GRID = '#ece9e4';
export const UP = '#006300';
export const DOWN = '#d03b3b';

export const STATUS_TONE: Record<OrderStatus, { bg: string; fg: string }> = {
  new: { bg: 'rgba(163,50,63,0.12)', fg: '#8c2430' },
  contacted: { bg: 'rgba(179,146,94,0.20)', fg: '#6b5427' },
  fulfilled: { bg: 'rgba(120,150,110,0.20)', fg: '#3e5637' },
  cancelled: { bg: 'rgba(18,22,43,0.09)', fg: '#5a5f70' },
};

export function StatusChip({ status }: { status: OrderStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-[11px] tracking-wide uppercase whitespace-nowrap"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {status}
    </span>
  );
}

export function Card({
  title, subtitle, action, children, className = '',
}: {
  title?: string; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; className?: string;
}) {
  return (
    <section
      className={`rounded-2xl px-6 py-5 ${className}`}
      style={{ background: '#ffffff', border: '1px solid var(--admin-line)', boxShadow: '0 1px 2px rgba(60,20,25,0.04)' }}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && (
              <h2 className="font-cormorant text-xl font-semibold leading-tight" style={{ color: 'var(--admin-ink)' }}>
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--admin-muted)' }}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatTile({
  label, value, delta, note,
}: { label: string; value: string; delta?: number | null; note?: string }) {
  return (
    <div
      className="rounded-2xl px-6 py-5"
      style={{ background: '#ffffff', border: '1px solid var(--admin-line)', boxShadow: '0 1px 2px rgba(60,20,25,0.04)' }}
    >
      <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: 'var(--admin-muted)' }}>{label}</p>
      <p className="text-[28px] font-semibold leading-tight mt-1.5" style={{ color: 'var(--admin-ink)' }}>
        {value}
      </p>
      {delta !== undefined && delta !== null && (
        <p className="text-xs mt-1.5" style={{ color: delta >= 0 ? UP : DOWN }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% <span style={{ color: 'var(--admin-muted)' }}>vs prev 30 days</span>
        </p>
      )}
      {note && <p className="text-xs mt-1.5" style={{ color: 'var(--admin-muted)' }}>{note}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm py-12 text-center" style={{ color: 'var(--admin-muted)' }}>{children}</p>
  );
}

export function SearchInput({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full sm:w-80 rounded-lg px-4 py-2 text-sm outline-none"
      style={{ background: '#ffffff', border: '1px solid var(--admin-line)', color: 'var(--admin-ink)' }}
    />
  );
}

export function Pager({
  page, pages, total, noun, onPage,
}: { page: number; pages: number; total: number; noun: string; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-4 mt-6 text-sm" style={{ color: 'var(--admin-ink)' }}>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="underline disabled:opacity-30">
        Previous
      </button>
      <span style={{ color: 'var(--admin-muted)' }}>
        Page {page} of {pages} · {total} {noun}
      </span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="underline disabled:opacity-30">
        Next
      </button>
    </div>
  );
}

export function pct(now: number, before: number): number | null {
  if (!before) return now ? 100 : null;
  return Math.round(((now - before) / before) * 100);
}

export function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function longDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

// A single-hue bar row: label above, value at the tip, 4px rounded data-end.
export function BarRow({
  label, value, sub, fraction, dim,
}: { label: string; value: string; sub?: string; fraction: number; dim?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1 gap-3" style={{ color: 'var(--admin-ink)' }}>
        <span className="truncate">{label}</span>
        <span className="shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
          {sub && <span style={{ color: 'var(--admin-muted)' }}> · {sub}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: TRACK }}>
        <div
          className="h-full"
          style={{
            width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
            background: SERIES,
            borderRadius: '9999px',
            opacity: dim ? 0.5 : 1,
            transition: 'opacity 120ms',
          }}
        />
      </div>
    </div>
  );
}

export function Tick({ value, top }: { value: number; top: string }) {
  return (
    <span
      className="absolute -left-1 text-[10px] px-1"
      style={{ top, color: 'var(--admin-muted)', background: '#ffffff', fontVariantNumeric: 'tabular-nums' }}
    >
      {value}
    </span>
  );
}

export function DailyOrders({
  perDay, formatMoney,
}: {
  perDay: Array<{ date: string; orders: number; revenueMinor: number }>;
  formatMoney: (minor: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = useMemo(() => Math.max(1, ...perDay.map((d) => d.orders)), [perDay]);
  const peak = useMemo(
    () => perDay.reduce((b, d, i) => (d.orders > perDay[b].orders ? i : b), 0),
    [perDay]
  );
  const busy = perDay.some((d) => d.orders > 0);

  const toggle = (
    <button onClick={() => setTable((t) => !t)} className="text-xs underline" style={{ color: 'var(--admin-muted)' }}>
      {table ? 'Show chart' : 'Show table'}
    </button>
  );

  if (table) {
    return (
      <>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs" style={{ color: 'var(--admin-ink)' }}>
            <thead>
              <tr style={{ color: 'var(--admin-muted)' }}>
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
        <div className="mt-3">{toggle}</div>
      </>
    );
  }

  if (!busy) {
    return (
      <>
        <Empty>No orders in the last 30 days.</Empty>
        <div className="mt-1">{toggle}</div>
      </>
    );
  }

  return (
    <>
      <div className="relative">
        {hover !== null && (
          <div
            className="absolute -top-2 z-10 rounded-lg px-3 py-2 text-xs pointer-events-none whitespace-nowrap"
            style={{
              left: `${(hover / perDay.length) * 100}%`,
              transform: hover > perDay.length / 2 ? 'translateX(-100%)' : 'none',
              background: '#ffffff', border: '1px solid var(--admin-line)',
              boxShadow: '0 8px 24px rgba(60,20,25,0.12)', color: 'var(--admin-ink)',
            }}
          >
            <strong>{shortDate(perDay[hover].date)}</strong>
            <br />
            {perDay[hover].orders} {perDay[hover].orders === 1 ? 'order' : 'orders'}
            <br />
            {formatMoney(perDay[hover].revenueMinor)}
          </div>
        )}

        <div className="relative" style={{ height: 160 }}>
          <div className="absolute inset-x-0 top-0" style={{ borderTop: `1px solid ${GRID}` }} />
          <div className="absolute inset-x-0 bottom-0" style={{ borderTop: '1px solid var(--admin-line)' }} />
          <Tick value={max} top="-8px" />
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
                className="flex-1 h-full flex items-end justify-center"
                style={{ maxWidth: 24 }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${(d.orders / max) * 100}%`,
                    minHeight: d.orders ? 3 : 0,
                    background: SERIES,
                    opacity: hover === null || hover === i ? 1 : 0.5,
                    borderRadius: '4px 4px 0 0',
                    transition: 'opacity 120ms',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between mt-2 text-[10px]" style={{ color: 'var(--admin-muted)' }}>
          <span>{shortDate(perDay[0].date)}</span>
          <span>peak {perDay[peak].orders} on {shortDate(perDay[peak].date)}</span>
          <span>{shortDate(perDay[perDay.length - 1].date)}</span>
        </div>
      </div>
      <div className="mt-3">{toggle}</div>
    </>
  );
}
