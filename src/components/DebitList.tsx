import React, { useMemo, useState } from 'react';
import { Plus, Trash2, TrendingUp, Filter, Download, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Debit } from '../types';
import { formatCurrency, exportToCSV, formatPKRDate, formatPKRTime } from '../utils/helpers';
import { formatPKR, formatUSD } from '../utils/currencyConverter';
import { sendAudit } from '../utils/audit';

interface DebitListProps {
  debits: Debit[];
  onDelete: (id: string) => void;
  onAddDebit: () => void;
}

const DebitList: React.FC<DebitListProps> = ({ debits, onDelete, onAddDebit }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'source' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const pkrBalanceAfterById = useMemo(() => {
    try {
      const debitsLocal = debits;
      const loans = JSON.parse(localStorage.getItem('amazon-agency-loans') || '[]');
      const expenses = JSON.parse(localStorage.getItem('amazon-agency-expenses') || '[]');
      const all = [
        ...expenses.map((x: any) => ({ id: x.id, date: x.date, deltaPKR: -x.amount })),
        ...debitsLocal.map((x) => ({ id: x.id, date: x.date, deltaPKR: x.amount })),
        ...loans.map((x: any) => ({ id: x.id, date: x.date, deltaPKR: -x.amount })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const map: Record<string, number> = {};
      let running = 0;
      for (const t of all) {
        running += t.deltaPKR;
        map[t.id] = running;
      }
      return map;
    } catch {
      return {} as Record<string, number>;
    }
  }, [debits]);

  const months = debits.reduce((acc, debit) => {
    const month = new Date(debit.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!acc.includes(month)) {
      acc.push(month);
    }
    return acc;
  }, [] as string[]);

  const filteredDebits = debits.filter(debit => {
    if (selectedMonth !== 'all') {
      const debitMonth = new Date(debit.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (debitMonth !== selectedMonth) return false;
    }
    const t = new Date(debit.date).getTime();
    if (startDate) {
      const s = new Date(startDate).setHours(0,0,0,0);
      if (t < s) return false;
    }
    if (endDate) {
      const e = new Date(endDate).setHours(23,59,59,999);
      if (t > e) return false;
    }
    return true;
  });

  const sortedDebits = [...filteredDebits].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'source':
        comparison = a.source.localeCompare(b.source);
        break;
      case 'description':
        comparison = (a.description || '').localeCompare(b.description || '');
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: 'date' | 'amount' | 'source' | 'description') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const totalIncome = filteredDebits.reduce((sum, debit) => sum + debit.usdAmount, 0);
  const totalIncomePKR = filteredDebits.reduce((sum, debit) => sum + debit.amount, 0);

  const handleExportCSV = () => {
    if (filteredDebits.length === 0) {
      alert('No income to export');
      return;
    }
    const csvData = filteredDebits.map(debit => ({
      Date: formatPKRDate(debit.date),
      Time: formatPKRTime(debit.date),
      Source: debit.source,
      Description: debit.description || '',
      'Amount (PKR)': debit.amount.toFixed(2),
      'Amount (USD)': debit.usdAmount.toFixed(2),
      'Balance After': debit.currentBalance.toFixed(2)
    }));
    const monthText = selectedMonth === 'all' ? 'All_Months' : selectedMonth.replace(/\s+/g, '_');
    const filename = `income_${monthText}_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(csvData, filename);
    sendAudit({ action: 'export', entity: 'debits', details: { count: filteredDebits.length, month: selectedMonth } });
  };

  const SortIcon = ({ field }: { field: 'date' | 'amount' | 'source' | 'description' }) => {
    if (sortBy !== field) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Income</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Track all money added to your balance</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleExportCSV} className="btn-secondary flex items-center text-sm py-1.5 px-3" disabled={filteredDebits.length === 0}>
            <Download size={16} className="mr-1" />
            Export
          </button>
          <button onClick={onAddDebit} className="btn-primary flex items-center text-sm py-1.5 px-3">
            <Plus size={16} className="mr-1" />
            Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-3 flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-gray-500" />
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm">
          <option value="all">All Months</option>
          {months.map((month) => (<option key={month} value={month}>{month}</option>))}
        </select>
        <span className="text-sm text-gray-600 dark:text-gray-400">From:</span>
        <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm" />
        <span className="text-sm text-gray-600 dark:text-gray-400">To:</span>
        <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm" />
        <button
          type="button"
          onClick={() => { setSelectedMonth('all'); setStartDate(''); setEndDate(''); setSortBy('date'); setSortOrder('desc'); }}
          className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-600 rounded"
        >
          <X size={14} />
          Clear Filters
        </button>
      </div>

      {/* Excel-style Table */}
      {sortedDebits.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
          <TrendingUp className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No income found</h3>
          <button onClick={onAddDebit} className="btn-primary mt-4">Add Income</button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-400 dark:border-gray-500">
          <table className="w-full border-collapse bg-white dark:bg-gray-800" style={{ minWidth: '800px' }}>
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 w-8">#</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('date')}>
                  <div className="flex items-center">Date<SortIcon field="date" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Time</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('source')}>
                  <div className="flex items-center">Source<SortIcon field="source" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('description')}>
                  <div className="flex items-center">Description<SortIcon field="description" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('amount')}>
                  <div className="flex items-center justify-end">Amount (PKR)<SortIcon field="amount" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Amount (USD)</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Balance (USD)</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Balance (PKR)</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-center text-xs font-bold text-gray-800 dark:text-gray-200 w-16">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedDebits.map((debit, index) => (
                <tr key={debit.id} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-center">{index + 1}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white whitespace-nowrap">{formatPKRDate(debit.date)}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatPKRTime(debit.date)}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white font-medium">{debit.source}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title={debit.description || ''}>{debit.description || '—'}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-success-600 dark:text-success-400 text-right font-medium">+{formatPKR(debit.amount)}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-success-600 dark:text-success-400 text-right">+{formatUSD(debit.usdAmount)}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white text-right font-medium">{formatCurrency(debit.currentBalance)}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-right">
                    {formatPKR(pkrBalanceAfterById[debit.id] ?? 0)}
                  </td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-center">
                    <button onClick={() => onDelete(debit.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 dark:bg-gray-700 font-bold">
                <td colSpan={5} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-gray-800 dark:text-gray-200 text-right">
                  Total ({filteredDebits.length} records):
                </td>
                <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-success-600 dark:text-success-400 text-right font-bold">+{formatPKR(totalIncomePKR)}</td>
                <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-success-600 dark:text-success-400 text-right font-bold">+{formatUSD(totalIncome)}</td>
                <td colSpan={3} className="border border-gray-400 dark:border-gray-500"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default DebitList;
