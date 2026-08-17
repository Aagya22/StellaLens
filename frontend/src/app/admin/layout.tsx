'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { href: '/admin', label: 'Overview', glyph: '◆' },
  { href: '/admin/orders', label: 'Orders', glyph: '❖' },
  { href: '/admin/customers', label: 'Customers', glyph: '✦' },
  { href: '/admin/pieces', label: 'Pieces', glyph: '✧' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isAdmin = user?.role === 'admin';

  const vars = {
    '--admin-bg': '#faf7f5',
    '--admin-ink': '#3d1f22',
    '--admin-muted': '#8d7275',
    '--admin-line': 'rgba(107,11,20,0.10)',
    '--admin-rail': '#5c0a11',
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
          <Link href="/" className="text-sm underline" style={{ color: 'var(--admin-rail)' }}>Back to the shop</Link>
        </div>
      </div>
    );
  }

  const title = NAV.find((n) => n.href === pathname)?.label ?? 'Admin';

  return (
    <div className="min-h-screen flex" style={{ ...vars, background: 'var(--admin-bg)' }}>
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: 'rgba(30,10,12,0.45)' }}
        />
      )}

      <aside
        className={`fixed z-40 inset-y-0 left-0 w-60 flex flex-col transition-transform md:translate-x-0 md:static ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--admin-rail)' }}
      >
        <div className="px-6 py-7">
          <p className="font-cormorant text-2xl leading-none" style={{ color: '#fdf6ee' }}>StellaLens</p>
          <p className="text-[10px] uppercase tracking-[0.22em] mt-1.5" style={{ color: 'rgba(253,246,238,0.55)' }}>
            Admin
          </p>
        </div>

        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition"
                style={{
                  background: active ? 'rgba(253,246,238,0.13)' : 'transparent',
                  color: active ? '#fdf6ee' : 'rgba(253,246,238,0.68)',
                }}
              >
                <span style={{ color: active ? 'var(--gold)' : 'rgba(253,246,238,0.35)', fontSize: 11 }}>
                  {item.glyph}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-6" style={{ borderTop: '1px solid rgba(253,246,238,0.12)' }}>
          <p className="text-xs truncate" style={{ color: '#fdf6ee' }}>{user?.name}</p>
          <p className="text-[11px] truncate mb-3" style={{ color: 'rgba(253,246,238,0.5)' }}>{user?.email}</p>
          <Link href="/" className="text-[11px] underline" style={{ color: 'rgba(253,246,238,0.75)' }}>
            Back to the shop
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-5 md:px-8 h-16"
          style={{ background: 'rgba(250,247,245,0.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--admin-line)' }}
        >
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="md:hidden text-lg leading-none"
            style={{ color: 'var(--admin-ink)' }}
          >
            ☰
          </button>
          <h1 className="font-cormorant text-2xl font-semibold" style={{ color: 'var(--admin-ink)' }}>{title}</h1>
        </header>

        <main className="flex-1 px-5 md:px-8 py-7">{children}</main>
      </div>
    </div>
  );
}
