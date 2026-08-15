'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import ConfirmDialog from '@/components/ConfirmDialog';

type Tab = 'home' | 'jewelry' | 'about' | 'checkout' | 'account';

interface NavbarProps {
  activeTab: Tab;
  goToTab: (tab: Tab) => void;
  onSignInClick: () => void;
  onCartClick: () => void;
  onAccountClick: () => void;
  cartCount: number;
}

export default function Navbar({
  activeTab,
  goToTab,
  onSignInClick,
  onCartClick,
  onAccountClick,
  cartCount,
}: NavbarProps) {
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const signOut = async () => {
    const name = user?.name;
    await logout();
    setConfirmSignOut(false);
    goToTab('home');
    toast({
      kind: 'info',
      title: 'Signed out',
      message: name
        ? `See you soon, ${name}. Your bag and ear fitting are saved to your account.`
        : 'Your bag and ear fitting are saved to your account.',
    });
  };

  return (
    <header
      className="fixed top-0 left-0 z-40 w-full"
      style={{
        background: 'var(--header-bg)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(74,64,56,0.08)',
      }}
    >
      <div className="w-full px-6 sm:px-12 py-3 flex items-center justify-between relative">
        <button
          onClick={() => goToTab('home')}
          className="cursor-pointer"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            letterSpacing: '0.06em',
            fontWeight: 400,
            color: '#000000',
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          STELLA LENS
        </button>

        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {(['home', 'jewelry'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => goToTab(tab)}
                className="underline-slide cursor-pointer"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  fontWeight: isActive ? 500 : 400,
                  color: '#000000',
                  transition: 'color 0.25s',
                  padding: '4px 0',
                  fontFamily: "var(--font-jost), sans-serif",
                }}
              >
                {tab}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-6 ml-auto">
          <button
            onClick={onCartClick}
            className="cursor-pointer relative text-[var(--header-text)] hover:opacity-85 transition-opacity"
            style={{ background: 'none', border: 'none', lineHeight: 0 }}
            title="Bag"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {cartCount > 0 && (
              <span
                className="absolute flex items-center justify-center"
                style={{
                  top: '-6px', right: '-8px', minWidth: '16px', height: '16px',
                  padding: '0 4px', borderRadius: '999px', background: 'var(--gold)',
                  color: '#fff', fontSize: '9px', lineHeight: 1,
                  fontFamily: "var(--font-jost), sans-serif",
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
          {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={onAccountClick}
                  className="hidden sm:inline underline-slide cursor-pointer"
                  title={`${user.email} — view your account`}
                  style={{
                    background: 'none', border: 'none', padding: '4px 0',
                    fontFamily: "var(--font-jost), sans-serif",
                    fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--header-text)', maxWidth: '110px',
                    fontWeight: activeTab === 'account' ? 500 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {user.name}
                </button>
                <button
                  onClick={() => setConfirmSignOut(true)}
                  className="cursor-pointer"
                  style={{
                    background: 'none', border: '1px solid rgba(74,64,56,0.2)',
                    borderRadius: '999px', padding: '6px 14px',
                    fontFamily: "var(--font-jost), sans-serif",
                    fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: 'var(--header-text)', whiteSpace: 'nowrap',
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={onSignInClick}
                className="cursor-pointer"
                style={{
                  background: 'none', border: '1px solid rgba(74,64,56,0.2)',
                  borderRadius: '999px', padding: '6px 14px',
                  fontFamily: "var(--font-jost), sans-serif",
                  fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase',
                  color: 'var(--header-text)', whiteSpace: 'nowrap',
                }}
              >
                Sign In
              </button>
            )
          )}
          <div className="flex md:hidden flex-col gap-1.5 cursor-pointer" style={{ lineHeight: 0 }}>
            <span className="block w-5 h-px" style={{ background: 'var(--header-text)' }} />
            <span className="block w-3 h-px" style={{ background: 'var(--header-text)' }} />
          </div>
        </div>
      </div>

      <div className="md:hidden flex justify-center gap-8 py-3" style={{ borderTop: '1px solid rgba(74,64,56,0.05)' }}>
        {(['home', 'jewelry'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => goToTab(tab)}
              className="cursor-pointer"
              style={{
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '1px solid var(--header-text)' : '1px solid transparent',
                fontSize: '10px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: isActive ? 500 : 400,
                color: '#000000',
                fontFamily: "var(--font-jost), sans-serif",
                paddingBottom: '2px',
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={confirmSignOut}
        title="Sign out of StellaLens?"
        message="Your bag, your ear fitting, and your orders stay saved to your account. You can sign back in any time."
        confirmLabel="Sign Out"
        cancelLabel="Stay Signed In"
        onConfirm={signOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </header>
  );
}
