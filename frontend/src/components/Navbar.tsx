'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';

type Tab = 'home' | 'jewelry' | 'about';

interface NavbarProps {
  activeTab: Tab;
  goToTab: (tab: Tab) => void;
  orderData: any;
  setOrderData: (data: any) => void;
  onSignInClick: () => void;
}

export default function Navbar({ activeTab, goToTab, orderData, setOrderData, onSignInClick }: NavbarProps) {
  const { user, loading, logout } = useAuth();
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
            className="cursor-pointer text-[var(--header-text)] hover:opacity-85 transition-opacity"
            style={{ background: 'none', border: 'none', lineHeight: 0 }}
            title="Search"
          >
            <svg width="19" height="19" viewBox="0 0 94 94" fill="currentColor">
              <path d="M94,89.8L79,74.8c6.9-7.9,11.1-18.3,11.1-29.6C90.1,20.2,69.8,0,44.9,0S-0.2,20.2-0.2,45.2s20.3,45.2,45.1,45.2c11.4,0,21.7-4.2,29.7-11.2l15,15,4.4-4.4ZM44.9,84.2c-21.5,0-39-17.5-39-39s17.5-39,39-39,39,17.5,39,39-17.5,39-39,39Z" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (orderData) {
                setOrderData(orderData);
              }
            }}
            className="cursor-pointer relative text-[var(--header-text)] hover:opacity-85 transition-opacity"
            style={{ background: 'none', border: 'none', lineHeight: 0 }}
            title="Stock"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            {orderData && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--gold)' }} />
            )}
          </button>
          {/* Account. Nothing is rendered until the session check settles, so
              a signed-in visitor never sees "Sign In" flash first. */}
          {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                <span
                  className="hidden sm:inline"
                  title={user.email}
                  style={{
                    fontFamily: "var(--font-jost), sans-serif",
                    fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase',
                    color: 'var(--header-text)', maxWidth: '110px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {user.name}
                </span>
                <button
                  onClick={() => void logout()}
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
    </header>
  );
}
