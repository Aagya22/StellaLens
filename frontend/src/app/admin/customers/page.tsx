'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, AdminCustomerList } from '@/lib/api';
import { formatMoney } from '@/context/CartContext';
import { Card, Empty, SearchInput, Pager, longDate } from '@/components/admin/ui';

export default function CustomersPage() {
  const [data, setData] = useState<AdminCustomerList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (search) params.set('q', search);
      setData(await api.get<AdminCustomerList>(`/api/admin/customers?${params}`));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load customers');
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-5">
      <SearchInput value={query} onChange={setQuery} placeholder="Search name or email" />

      {error && <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>}

      <Card>
        {loading && !data ? (
          <Empty>Loading customers…</Empty>
        ) : !data?.customers.length ? (
          <Empty>{search ? 'No one matches that.' : 'No one has registered yet.'}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ color: 'var(--admin-ink)' }}>
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.1em]" style={{ color: 'var(--admin-muted)' }}>
                  <th className="text-left font-normal pb-2.5">Customer</th>
                  <th className="text-left font-normal pb-2.5 whitespace-nowrap">Joined</th>
                  <th className="text-left font-normal pb-2.5">Fitting</th>
                  <th className="text-right font-normal pb-2.5">Orders</th>
                  <th className="text-right font-normal pb-2.5">Spent</th>
                  <th className="text-left font-normal pb-2.5 whitespace-nowrap">Last order</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--admin-line)' }}>
                    <td className="py-3 pr-4 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate">{c.name}</span>
                        {c.role === 'admin' && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide"
                            style={{ background: 'rgba(179,146,94,0.20)', color: '#6b5427' }}
                          >
                            admin
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs" style={{ color: 'var(--admin-muted)' }}>{c.email}</span>
                    </td>
                    <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: 'var(--admin-muted)' }}>
                      {longDate(c.createdAt)}
                    </td>
                    <td className="py-3 pr-4 text-xs" style={{ color: 'var(--admin-muted)' }}>
                      {c.calibrated ? 'Ears set' : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>{c.orders}</td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {c.spentMinor ? formatMoney(c.spentMinor) : '—'}
                    </td>
                    <td className="py-3 text-xs whitespace-nowrap" style={{ color: 'var(--admin-muted)' }}>
                      {c.lastOrderAt ? longDate(c.lastOrderAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && <Pager page={data.page} pages={data.pages} total={data.total} noun="customers" onPage={setPage} />}
    </div>
  );
}
