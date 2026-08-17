'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, AdminNotifications } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { IconBell } from '@/components/admin/icons';

const POLL_MS = 60_000;
const GOLD = '#c2a06a';

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const { toast } = useToast();
  const [data, setData] = useState<AdminNotifications | null>(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastCount = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try {
      const next = await api.get<AdminNotifications>('/api/admin/notifications');
      setData(next);

      const prev = lastCount.current;
      if (prev !== null && next.customers.count > prev) {
        const fresh = next.customers.count - prev;
        toast({
          kind: 'info',
          title: fresh === 1 ? 'New customer registered' : `${fresh} new customers registered`,
          message: next.customers.items[0]?.name,
        });
      }
      lastCount.current = next.customers.count;
    } catch {
    }
  }, [toast]);

  useEffect(() => {
    void poll();
    const id = setInterval(() => { if (!document.hidden) void poll(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const count = data?.customers.count ?? 0;
  const items = data?.customers.items ?? [];

  const markSeen = async () => {
    try {
      await api.post('/api/admin/notifications/seen');
      lastCount.current = 0;
      setData((d) => (d ? { ...d, customers: { ...d.customers, count: 0 } } : d));
    } catch {
      toast({ kind: 'error', title: 'Could not mark those as read' });
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={count ? `${count} new registrations` : 'Notifications'}
        className="relative grid h-9 w-9 place-items-center rounded-full transition"
        style={{
          background: open ? 'rgba(28,36,56,0.06)' : 'transparent',
          color: 'var(--admin-ink)',
        }}
      >
        <IconBell />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 grid min-w-[17px] h-[17px] place-items-center rounded-full px-1 text-[10px] font-semibold"
            style={{ background: GOLD, color: '#241a08' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[19rem] rounded-2xl overflow-hidden z-50"
          style={{
            background: '#ffffff', border: '1px solid var(--admin-line)',
            boxShadow: '0 16px 40px rgba(11,23,48,0.16)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--admin-line)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--admin-ink)' }}>
              New registrations
            </p>
            {count > 0 && (
              <button onClick={markSeen} className="text-xs underline" style={{ color: 'var(--admin-muted)' }}>
                Mark as read
              </button>
            )}
          </div>

          {!items.length ? (
            <p className="px-4 py-8 text-sm text-center" style={{ color: 'var(--admin-muted)' }}>
              Nobody new since you last looked.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((c) => (
                <li key={c.id} className="px-4 py-3" style={{ borderBottom: '1px solid var(--admin-line)' }}>
                  <div className="flex items-start gap-2.5">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] mt-0.5"
                      style={{ background: 'rgba(194,160,106,0.18)', color: '#6b5427' }}
                    >
                      {c.name.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm" style={{ color: 'var(--admin-ink)' }}>{c.name}</span>
                      <span className="block truncate text-xs" style={{ color: 'var(--admin-muted)' }}>{c.email}</span>
                    </span>
                    <span className="text-[11px] whitespace-nowrap mt-0.5" style={{ color: 'var(--admin-muted)' }}>
                      {ago(c.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/admin/customers"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm text-center"
            style={{ color: 'var(--admin-ink)' }}
          >
            View all customers
          </Link>
        </div>
      )}
    </div>
  );
}
