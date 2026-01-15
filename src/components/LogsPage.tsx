import React, { useMemo, useState } from 'react';
import { Download, Filter, ChevronUp, ChevronDown, X } from 'lucide-react';
import { exportToCSV, formatPKRDate, formatPKRTime } from '../utils/helpers';
import { formatPKR, formatUSD } from '../utils/currencyConverter';

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
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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
    const inRange = list.filter((e) => {
      const t = e.timeMs || 0;
      if (startDate) {
        const s = new Date(startDate).setHours(0,0,0,0);
        if (t < s) return false;
      }
      if (endDate) {
        const ed = new Date(endDate).setHours(23,59,59,999);
        if (t > ed) return false;
      }
      return true;
    });
    const sorted = [...inRange].sort((a, b) => {
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
  }, [normalized, query, sortBy, sortOrder, startDate, endDate]);

  const handleSort = (field: 'time' | 'action' | 'entity' | 'name' | 'amountPKR') => {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const exportCSV = () => {
    const rows = filtered.map((e) => ({
      Date: formatPKRDate(new Date(e.timeMs).toISOString()),
      Time: formatPKRTime(new Date(e.timeMs).toISOString()),
      Action: e.action,
      Entity: e.entity,
      Name: e.details?.name || '',
      'Amount (PKR)': typeof e.details?.amountPKR === 'number' ? e.details!.amountPKR : '',
      'Amount (USD)': typeof e.details?.amountUSD === 'number' ? e.details!.amountUSD : '',
      By: e.actor?.email || '',
    }));
    exportToCSV(rows, `logs_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const SortIcon = ({ field }: { field: 'time' | 'action' | 'entity' | 'name' | 'amountPKR' }) => {
    if (sortBy !== field) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
  };

  const totalAmountPKR = filtered.reduce((sum, e) => sum + (e.details?.amountPKR || 0), 0);
  const totalAmountUSD = filtered.reduce((sum, e) => sum + (e.details?.amountUSD || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Logs</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">All audit events across both admins</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={exportCSV} className="btn-secondary flex items-center text-sm py-1.5 px-3" disabled={filtered.length === 0}>
            <Download size={16} className="mr-1" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-3 flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search action, entity, name, email"
          className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm flex-1 min-w-[200px]"
        />
        <span className="text-sm text-gray-600 dark:text-gray-400">From:</span>
        <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm" />
        <span className="text-sm text-gray-600 dark:text-gray-400">To:</span>
        <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm" />
        {(query || startDate || endDate) && (
          <button
            type="button"
            onClick={() => { setQuery(''); setStartDate(''); setEndDate(''); setSortBy('time'); setSortOrder('desc'); }}
            className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-600 rounded"
          >
            <X size={14} />
            Clear Filters
          </button>
        )}
      </div>

      {/* Excel-style Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
          <Filter className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No logs found</h3>
          <p className="text-gray-600 dark:text-gray-400">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-400 dark:border-gray-500">
          <table className="w-full border-collapse bg-white dark:bg-gray-800" style={{ minWidth: '1000px' }}>
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 w-8">#</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('time')}>
                  <div className="flex items-center">Date<SortIcon field="time" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Time</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('action')}>
                  <div className="flex items-center">Action<SortIcon field="action" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('entity')}>
                  <div className="flex items-center">Entity<SortIcon field="entity" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Name<SortIcon field="name" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('amountPKR')}>
                  <div className="flex items-center justify-end">Amount (PKR)<SortIcon field="amountPKR" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Amount (USD)</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, index) => {
                const date = new Date(e.timeMs);
                return (
                  <tr key={e.id} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-center">{index + 1}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white whitespace-nowrap">{formatPKRDate(date.toISOString())}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatPKRTime(date.toISOString())}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white font-medium">{e.action}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300">{e.entity}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title={e.details?.name || ''}>{e.details?.name || '—'}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 text-right">
                      {typeof e.details?.amountPKR === 'number' ? formatPKR(e.details.amountPKR) : '—'}
                    </td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 text-right">
                      {typeof e.details?.amountUSD === 'number' ? formatUSD(e.details.amountUSD) : '—'}
                    </td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title={e.actor?.email || ''}>{e.actor?.email || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 dark:bg-gray-700 font-bold">
                <td colSpan={6} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-gray-800 dark:text-gray-200 text-right">
                  Total ({filtered.length} records):
                </td>
                <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-gray-800 dark:text-gray-200 text-right font-bold">
                  {totalAmountPKR > 0 ? formatPKR(totalAmountPKR) : '—'}
                </td>
                <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-gray-800 dark:text-gray-200 text-right font-bold">
                  {totalAmountUSD > 0 ? formatUSD(totalAmountUSD) : '—'}
                </td>
                <td className="border border-gray-400 dark:border-gray-500"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default LogsPage;
