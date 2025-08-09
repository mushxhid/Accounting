import React, { useMemo, useState } from 'react';
import { Plus, Trash2, TrendingUp, Calendar, Filter, Download } from 'lucide-react';
import { Debit } from '../types';
import { formatCurrency, exportToCSV } from '../utils/helpers';
import { formatPKR, formatUSD } from '../utils/currencyConverter';
import { sendAudit } from '../utils/audit';

interface DebitListProps {
  debits: Debit[];
  onDelete: (id: string) => void;
  onAddDebit: () => void;
}

const DebitList: React.FC<DebitListProps> = ({ debits, onDelete, onAddDebit }) => {
  // no live rate needed

  // Exact PKR balance-after reconstruction from stored PKR transactions
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

  //
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'source' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Get unique months from debits
  const months = debits.reduce((acc, debit) => {
    const month = new Date(debit.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!acc.includes(month)) {
      acc.push(month);
    }
    return acc;
  }, [] as string[]);

  // Filter debits by selected month and date range
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

  // Sort debits
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

  const handleExportCSV = () => {
    if (filteredDebits.length === 0) {
      alert('No income to export');
      return;
    }

    // Prepare data for CSV export
    const csvData = filteredDebits.map(debit => ({
      Date: new Date(debit.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }),
      Time: new Date(debit.date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Income History</h1>
          <p className="text-gray-600 mt-1">Track all money added to your balance</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="btn-secondary flex items-center"
            disabled={filteredDebits.length === 0}
          >
            <Download size={20} className="mr-2" />
            Export CSV
          </button>
          <button
            onClick={onAddDebit}
            className="btn-primary flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Add Income
          </button>
        </div>
      </div>

      {/* Stats Card */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-success-100 rounded-lg">
              <TrendingUp className="text-success-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalIncome)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Filtered Income</p>
            <p className="text-lg font-semibold text-gray-900">
              {filteredDebits.length} income{filteredDebits.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter:</span>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input-field max-w-xs"
            >
              <option value="all">All Months</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
                          <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as ['date' | 'amount' | 'source' | 'description', 'asc' | 'desc'];
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="input-field"
              >
                <option value="date-desc">Date (Newest)</option>
                <option value="date-asc">Date (Oldest)</option>
                <option value="amount-desc">Amount (High to Low)</option>
                <option value="amount-asc">Amount (Low to High)</option>
                <option value="source-asc">Source (A-Z)</option>
                <option value="source-desc">Source (Z-A)</option>
                <option value="description-asc">Description (A-Z)</option>
                <option value="description-desc">Description (Z-A)</option>
              </select>
          </div>
          <div className="flex items-center space-x-2 pt-4 sm:pt-0">
            <span className="text-sm font-medium text-gray-700">Date:</span>
            <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="input-field" />
            <span className="text-sm text-gray-500">to</span>
            <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="input-field" />
          </div>
        </div>
      </div>

      {/* Income Table */}
      <div className="card">
        {sortedDebits.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No income found</h3>
            <p className="text-gray-600 mb-6">
              {selectedMonth === 'all' 
                ? 'Start adding money to your balance to see your income history here.'
                : `No income found for ${selectedMonth}.`
              }
            </p>
            <button
              onClick={onAddDebit}
              className="btn-primary"
            >
              Add Your First Income
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <Calendar size={16} />
                      <span>Date</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('source')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <TrendingUp size={16} />
                      <span>Source</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('description')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <span>Description</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <span>Amount</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Balance After
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDebits.map((debit) => (
                  <tr
                    key={debit.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-success-100 rounded-lg">
                          <TrendingUp className="text-success-600" size={16} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {new Date(debit.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(debit.date).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-medium text-gray-900">{debit.source}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-gray-700 text-sm">
                        {debit.description || '-'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-semibold text-success-600">
                          +{formatPKR(debit.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          ({formatUSD(debit.usdAmount)})
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-right md:text-left">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(debit.currentBalance)}
                        </p>
                        <p className="text-xs text-gray-500">{formatPKR(pkrBalanceAfterById[debit.id] ?? 0)}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => onDelete(debit.id)}
                        className="text-danger-600 hover:text-danger-700 p-2 rounded-lg hover:bg-danger-50 transition-colors"
                        title="Delete income"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebitList; 