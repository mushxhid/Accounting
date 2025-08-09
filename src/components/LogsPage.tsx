import React, { useMemo, useState } from 'react';
import { Download, Filter } from 'lucide-react';
import { exportToCSV } from '../utils/helpers';

type AuditEvent = {
  id: string;
  action: string;
  entity: string;
  timestamp?: string;
  _createdAt?: any;
  actor?: { email?: string };
  details?: {
    id?: string;
    name?: string;
    amountPKR?: number;
    amountUSD?: number;
    [key: string]: any;
  };
};

interface LogsPageProps {
  audit: AuditEvent[];
}

const LogsPage: React.FC<LogsPageProps> = ({ audit }) => {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'time' | 'action' | 'entity' | 'name' | 'amountPKR'>('time');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const normalized = useMemo(() => {
    return (audit || []).map((e) => ({
      ...e,
      timeMs: e.timestamp ? Date.parse(e.timestamp) : e._createdAt?.toDate?.()?.getTime?.() ?? 0,
      name: e.details?.name || '',
      amountPKR: typeof e.details?.amountPKR === 'number' ? e.details!.amountPKR : undefined,
    }));
  }, [audit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? normalized.filter((e) =>
          [e.action, e.entity, e.actor?.email, e.details?.name]
            .filter(Boolean)
            .some((s) => String(s).toLowerCase().includes(q))
        )
      : normalized;
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'time':
          cmp = (a.timeMs || 0) - (b.timeMs || 0);
          break;
        case 'action':
          cmp = a.action.localeCompare(b.action);
          break;
        case 'entity':
          cmp = a.entity.localeCompare(b.entity);
          break;
        case 'name':
          cmp = (a.details?.name || '').localeCompare(b.details?.name || '');
          break;
        case 'amountPKR':
          cmp = (a.details?.amountPKR || 0) - (b.details?.amountPKR || 0);
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [normalized, query, sortBy, sortOrder]);

  const handleSort = (field: 'time' | 'action' | 'entity' | 'name' | 'amountPKR') => {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const exportCSV = () => {
    const rows = filtered.map((e) => ({
      Time: new Date(e.timeMs).toLocaleString(),
      Action: e.action,
      Entity: e.entity,
      Name: e.details?.name || '',
      'Amount (PKR)': typeof e.details?.amountPKR === 'number' ? e.details!.amountPKR : '',
      'Amount (USD)': typeof e.details?.amountUSD === 'number' ? e.details!.amountUSD : '',
      By: e.actor?.email || '',
    }));
    exportToCSV(rows, `logs_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-gray-600">All audit events across both admins</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border rounded px-3 py-1.5">
            <Filter size={16} className="text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search action, entity, name, email"
              className="outline-none text-sm"
            />
          </div>
          <button onClick={exportCSV} className="btn-secondary flex items-center">
            <Download size={18} className="mr-2" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => handleSort('time')}>When</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => handleSort('action')}>Action</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => handleSort('entity')}>Entity</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => handleSort('name')}>Name</th>
                <th className="px-4 py-2 text-left cursor-pointer" onClick={() => handleSort('amountPKR')}>Amount (PKR)</th>
                <th className="px-4 py-2 text-left">Amount (USD)</th>
                <th className="px-4 py-2 text-left">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2">{new Date(e.timeMs).toLocaleString()}</td>
                  <td className="px-4 py-2 font-medium">{e.action}</td>
                  <td className="px-4 py-2">{e.entity}</td>
                  <td className="px-4 py-2">{e.details?.name || ''}</td>
                  <td className="px-4 py-2">{typeof e.details?.amountPKR === 'number' ? e.details!.amountPKR.toLocaleString() : ''}</td>
                  <td className="px-4 py-2">{typeof e.details?.amountUSD === 'number' ? e.details!.amountUSD.toFixed(2) : ''}</td>
                  <td className="px-4 py-2">{e.actor?.email || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LogsPage;


