'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import NotificationBell from '@/components/admin/NotificationBell';
import {
  IconOverview, IconOrders, IconCustomers, IconPieces,
  IconShop, IconSignOut, IconGem, IconMenu, IconClose,
} from '@/components/admin/icons';

type Entry = { name: string; path: string; section: string; icon: React.ReactNode };

const NAV: Entry[] = [
  { name: 'Overview', path: '/admin', section: 'Menu', icon: <IconOverview /> },
  { name: 'Orders', path: '/admin/orders', section: 'Commerce', icon: <IconOrders /> },
  { name: 'Customers', path: '/admin/customers', section: 'Commerce', icon: <IconCustomers /> },
  { name: 'Pieces', path: '/admin/pieces', section: 'Catalogue', icon: <IconPieces /> },
];
const SECTIONS = ['Menu', 'Commerce', 'Catalogue'];

const RAIL = '#0b1730';
const RAIL_DEEP = '#081124';
const GOLD = '#c2a06a';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const isAdmin = user?.role === 'admin';

  const vars = {
    '--admin-bg': '#f6f5f3',
    '--admin-ink': '#1c2438',
    '--admin-muted': '#6f7891',
    '--admin-line': 'rgba(28,36,56,0.10)',
    '--admin-rail': RAIL,
    '--admin-accent': GOLD,
  } as React.CSSProperties;

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ ...vars, background: 'var(--admin-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--admin-muted)' }}>Checking your access…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center px-6" style={{ ...vars, background: 'var(--admin-bg)' }}>
        <div className="text-center">
          <h1 className="font-cormorant text-4xl mb-2" style={{ color: 'var(--admin-ink)' }}>Not available</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--admin-muted)' }}>This area is for StellaLens staff.</p>
          <Link href="/" className="text-sm underline" style={{ color: 'var(--admin-ink)' }}>Back to the shop</Link>
        </div>
      </div>
    );
  }

  const current = NAV.find((n) => n.path === pathname);
  const groups = SECTIONS
    .map((s) => ({ section: s, entries: NAV.filter((n) => n.section === s) }))
    .filter((g) => g.entries.length);

  const NavRow = ({ item, showLabel, onGo }: { item: Entry; showLabel: boolean; onGo?: () => void }) => {
    const active = pathname === item.path;
    return (
      <Link
        href={item.path}
        onClick={onGo}
        aria-label={item.name}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex h-11 items-center gap-3 rounded-2xl transition-all duration-200 ${
          showLabel ? 'px-3' : 'justify-center px-0'
        }`}
        style={{
          background: active ? 'rgba(194,160,106,0.14)' : 'transparent',
          color: active ? '#f4efe6' : 'rgba(226,231,242,0.62)',
          boxShadow: active ? 'inset 0 0 0 1px rgba(194,160,106,0.22)' : 'none',
        }}
      >
        <span className="flex-shrink-0" style={{ color: active ? GOLD : 'rgba(226,231,242,0.5)' }}>
          {item.icon}
        </span>
        {showLabel && <span className="text-[14px] whitespace-nowrap">{item.name}</span>}
        {!showLabel && (
          <span
            className="pointer-events-none absolute left-[54px] z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] opacity-0 transition-opacity delay-200 duration-150 group-hover:opacity-100"
            style={{ background: RAIL_DEEP, color: '#e6ebf5', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            {item.name}
          </span>
        )}
      </Link>
    );
  };

  const NavZone = ({ showLabel, onGo }: { showLabel: boolean; onGo?: () => void }) => (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
      {groups.map((g, gi) => (
        <div key={g.section} className="space-y-1">
          {showLabel ? (
            <p className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-[0.18em]" style={{ color: 'rgba(226,231,242,0.32)' }}>
              {g.section}
            </p>
          ) : (
            gi > 0 && <div className="mx-auto my-2 h-px w-6" style={{ background: 'rgba(255,255,255,0.10)' }} />
          )}
          {g.entries.map((item) => <NavRow key={item.path} item={item} showLabel={showLabel} onGo={onGo} />)}
        </div>
      ))}
    </nav>
  );

  const AccountZone = ({ showLabel, onGo }: { showLabel: boolean; onGo?: () => void }) => (
    <div
      className="flex-shrink-0 space-y-1 pb-4 pt-2"
      style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
    >
      {showLabel && (
        <div className="flex items-center gap-2.5 px-3 pt-2 pb-1.5">
          <span
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-[12px]"
            style={{ background: 'rgba(194,160,106,0.18)', color: GOLD }}
          >
            {(user?.name ?? '?').trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px]" style={{ color: '#e6ebf5' }}>{user?.name}</span>
            <span className="block truncate text-[10px]" style={{ color: 'rgba(226,231,242,0.45)' }}>{user?.email}</span>
          </span>
        </div>
      )}

      <Link
        href="/"
        onClick={onGo}
        aria-label="Back to the shop"
        className={`group relative flex h-11 items-center gap-3 rounded-2xl transition ${showLabel ? 'px-3' : 'justify-center px-0'}`}
        style={{ color: 'rgba(226,231,242,0.62)' }}
      >
        <span className="flex-shrink-0" style={{ color: 'rgba(226,231,242,0.5)' }}><IconShop /></span>
        {showLabel && <span className="text-[14px] whitespace-nowrap">Back to the shop</span>}
      </Link>

      <button
        onClick={() => { onGo?.(); setConfirmOut(true); }}
        aria-label="Sign out"
        className={`group flex h-11 w-full items-center gap-3 rounded-2xl transition hover:bg-white/[0.06] ${
          showLabel ? 'px-3' : 'justify-center px-0'
        }`}
        style={{ color: 'rgba(226,231,242,0.62)' }}
      >
        <span className="flex-shrink-0" style={{ color: 'rgba(226,231,242,0.5)' }}><IconSignOut /></span>
        {showLabel && <span className="text-[14px] whitespace-nowrap">Sign out</span>}
      </button>
    </div>
  );

  const Brand = ({ showLabel, onClose }: { showLabel: boolean; onClose?: () => void }) => (
    <div
      className="flex flex-shrink-0 items-center gap-3 py-5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <span
        className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl"
        style={{ background: 'rgba(194,160,106,0.16)', color: GOLD, border: '1px solid rgba(194,160,106,0.28)' }}
      >
        <IconGem />
      </span>
      {showLabel && (
        <span className="min-w-0 flex-1">
          <span className="block font-cormorant text-lg leading-none" style={{ color: '#f4efe6' }}>StellaLens</span>
          <span className="block text-[9px] uppercase tracking-[0.24em] mt-1" style={{ color: 'rgba(226,231,242,0.4)' }}>
            Admin
          </span>
        </span>
      )}
      {onClose && (
        <button onClick={onClose} aria-label="Close menu" style={{ color: 'rgba(226,231,242,0.6)' }}>
          <IconClose />
        </button>
      )}
    </div>
  );

  const railSurface = { background: `linear-gradient(180deg, #101f3d 0%, ${RAIL} 45%, ${RAIL_DEEP} 100%)` };

  return (
    <div className="min-h-screen flex" style={{ ...vars, background: 'var(--admin-bg)' }}>
      {/* Desktop rail: floats inset, icon-only until hovered. */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`sticky top-3 z-40 my-3 ml-3 hidden h-[calc(100vh-1.5rem)] flex-shrink-0 flex-col overflow-hidden rounded-[26px] transition-[width,padding] duration-300 ease-out md:flex ${
          expanded ? 'w-[236px] px-3.5' : 'w-[72px] px-3'
        }`}
        style={{ ...railSurface, boxShadow: '0 18px 40px rgba(11,23,48,0.18)' }}
      >
        <Brand showLabel={expanded} />
        <NavZone showLabel={expanded} />
        <AccountZone showLabel={expanded} />
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(8,17,36,0.55)', backdropFilter: 'blur(2px)' }}
        />
      )}

      <aside
        className={`fixed bottom-0 left-0 top-0 z-40 flex w-64 flex-col px-4 transition-transform duration-300 md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={railSurface}
      >
        <Brand showLabel onClose={() => setMobileOpen(false)} />
        <NavZone showLabel onGo={() => setMobileOpen(false)} />
        <AccountZone showLabel onGo={() => setMobileOpen(false)} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-5 md:px-9 h-16"
          style={{ background: 'rgba(246,245,243,0.88)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--admin-line)' }}
        >
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="md:hidden" style={{ color: 'var(--admin-ink)' }}>
            <IconMenu />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: 'var(--admin-muted)' }}>
              {current?.section ?? 'Admin'}
            </p>
            <h1 className="font-cormorant text-2xl font-semibold leading-none" style={{ color: 'var(--admin-ink)' }}>
              {current?.name ?? 'Admin'}
            </h1>
          </div>
          <div className="shrink-0">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 px-5 md:px-9 py-8 md:py-10">{children}</main>
      </div>

      <ConfirmDialog
        isOpen={confirmOut}
        title="Sign out?"
        message="You'll need to sign in again to reach the admin area."
        confirmLabel="Sign out"
        destructive
        onCancel={() => setConfirmOut(false)}
        onConfirm={async () => {
          setConfirmOut(false);
          await logout();
          toast({ kind: 'info', title: 'Signed out' });
          router.push('/');
        }}
      />
    </div>
  );
}
