import React, { useMemo, useState } from 'react';
import { Plus, Trash2, UserCheck, Filter, Download, Wallet, ChevronDown, ChevronRight, Edit3, X as XIcon, ChevronUp } from 'lucide-react';
import { Loan } from '../types';
import { formatCurrency, exportToCSV, formatPKRDate, formatPKRTime } from '../utils/helpers';
import { formatPKR, formatUSD } from '../utils/currencyConverter';
import { sendAudit } from '../utils/audit';

interface LoanListProps {
  loans: Loan[];
  onDelete: (id: string) => void;
  onAddLoan: () => void;
  onOpenRepay: (loanId: string) => void;
  onEditRepayment?: (loanId: string, repaymentId: string) => void;
  onDeleteRepayment?: (loanId: string, repaymentId: string) => void;
}

const LoanList: React.FC<LoanListProps> = ({ loans, onDelete, onAddLoan, onOpenRepay, onEditRepayment, onDeleteRepayment }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'partnerName'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const pkrBalanceAfterById = useMemo(() => {
    try {
      const loansLocal = loans;
      const debits = JSON.parse(localStorage.getItem('amazon-agency-debits') || '[]');
      const expenses = JSON.parse(localStorage.getItem('amazon-agency-expenses') || '[]');
      const all = [
        ...expenses.map((x: any) => ({ id: x.id, date: x.date, deltaPKR: -x.amount })),
        ...debits.map((x: any) => ({ id: x.id, date: x.date, deltaPKR: x.amount })),
        ...loansLocal.map((x) => ({ id: x.id, date: x.date, deltaPKR: -x.amount })),
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
  }, [loans]);

  const months = useMemo(() => {
    const monthSet = new Set<string>();
    loans.forEach(loan => {
      const date = new Date(loan.date);
      const monthYear = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      monthSet.add(monthYear);
    });
    return Array.from(monthSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [loans]);

  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      const date = new Date(loan.date);
      const monthYear = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (selectedMonth !== 'all' && monthYear !== selectedMonth) return false;
      const t = date.getTime();
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
  }, [loans, selectedMonth, startDate, endDate]);

  const sortedLoans = useMemo(() => {
    return [...filteredLoans].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'partnerName':
          comparison = a.partnerName.localeCompare(b.partnerName);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredLoans, sortBy, sortOrder]);

  const handleSort = (field: 'date' | 'amount' | 'partnerName') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const totalLoans = filteredLoans.length;
  const totalAmount = filteredLoans.reduce((sum, loan) => sum + loan.usdAmount, 0);
  const totalAmountPKR = filteredLoans.reduce((sum, loan) => sum + loan.amount, 0);

  const handleExportCSV = () => {
    if (filteredLoans.length === 0) {
      alert('No loans to export');
      return;
    }
    const csvData: any[] = [];
    filteredLoans.forEach(loan => {
      csvData.push({
        Date: formatPKRDate(loan.date),
        Time: formatPKRTime(loan.date),
        'Partner Name': loan.partnerName,
        'Amount (PKR)': (-loan.amount).toFixed(2),
        'Amount (USD)': (-loan.usdAmount).toFixed(2),
        Description: loan.description || '',
        'Balance After (USD)': loan.currentBalance.toFixed(2)
      });
      (loan.repayments || []).forEach(r => {
        csvData.push({
          Date: formatPKRDate(r.date),
          Time: formatPKRTime(r.date),
          'Partner Name': loan.partnerName,
          'Amount (PKR)': r.amount.toFixed(2),
          'Amount (USD)': r.usdAmount.toFixed(2),
          Description: r.description || '',
          'Balance After (USD)': ''
        });
      });
    });
    const monthText = selectedMonth === 'all' ? 'All_Months' : selectedMonth.replace(/\s+/g, '_');
    const filename = `partner_loans_${monthText}_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(csvData, filename);
    sendAudit({ action: 'export', entity: 'loans', details: { count: filteredLoans.length, month: selectedMonth } });
  };

  const SortIcon = ({ field }: { field: 'date' | 'amount' | 'partnerName' }) => {
    if (sortBy !== field) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Partner Loans</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{totalLoans} loan{totalLoans !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleExportCSV} className="btn-secondary flex items-center text-sm py-1.5 px-3" disabled={filteredLoans.length === 0}>
            <Download size={16} className="mr-1" />
            Export
          </button>
          <button onClick={onAddLoan} className="btn-primary flex items-center text-sm py-1.5 px-3">
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
          {months.map(month => (<option key={month} value={month}>{month}</option>))}
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
          <XIcon size={14} />
          Clear Filters
        </button>
      </div>

      {/* Excel-style Table */}
      {sortedLoans.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
          <UserCheck className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No loans found</h3>
          <button onClick={onAddLoan} className="btn-primary mt-4">Add Loan</button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-400 dark:border-gray-500">
          <table className="w-full border-collapse bg-white dark:bg-gray-800" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 w-8">#</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('date')}>
                  <div className="flex items-center">Date<SortIcon field="date" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Time</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('partnerName')}>
                  <div className="flex items-center">Partner<SortIcon field="partnerName" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Description</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('amount')}>
                  <div className="flex items-center justify-end">Amount (PKR)<SortIcon field="amount" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Amount (USD)</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Balance (USD)</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Balance (PKR)</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-center text-xs font-bold text-gray-800 dark:text-gray-200 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedLoans.map((loan, index) => {
                const isOpen = !!expanded[loan.id];
                const principalPKR = loan.principalAmount ?? loan.amount + (loan.repayments?.reduce((s, r) => s + r.amount, 0) ?? 0);
                const paidRatio = principalPKR > 0 ? 1 - (loan.amount / principalPKR) : 0;
                return (
                  <React.Fragment key={loan.id}>
                    <tr className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-center">{index + 1}</td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white whitespace-nowrap">{formatPKRDate(loan.date)}</td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatPKRTime(loan.date)}</td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white font-medium">{loan.partnerName}</td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title={loan.description || ''}>{loan.description || '—'}</td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 text-right font-medium">-{formatPKR(loan.amount)}</td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 text-right">-{formatUSD(loan.usdAmount)}</td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white text-right font-medium">{formatCurrency(loan.currentBalance)}</td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-right">
                        {formatPKR(pkrBalanceAfterById[loan.id] ?? 0)}
                      </td>
                      <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setExpanded(prev => ({ ...prev, [loan.id]: !prev[loan.id] }))} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1" title={isOpen ? 'Hide repayments' : 'Show repayments'}>
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <button onClick={() => onOpenRepay(loan.id)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 p-1" title="Record repayment">
                            <Wallet size={14} />
                          </button>
                          <button onClick={() => onDelete(loan.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && loan.repayments && loan.repayments.length > 0 && (
                      <tr className="bg-gray-50 dark:bg-gray-700/30">
                        <td colSpan={10} className="border border-gray-400 dark:border-gray-500 px-2 py-2">
                          <div className="ml-4 space-y-1">
                            <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">Repayments:</div>
                            {loan.repayments.map((r) => (
                              <div key={r.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 text-xs">
                                <div>
                                  <span className="font-medium text-gray-900 dark:text-white">{formatPKRDate(r.date)}</span>
                                  {r.description && <span className="text-gray-600 dark:text-gray-400 ml-2">- {r.description}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-success-600 dark:text-success-400 font-medium">+{formatPKR(r.amount)}</span>
                                  <span className="text-gray-500 dark:text-gray-400">({formatUSD(r.usdAmount)})</span>
                                  {onEditRepayment && (
                                    <button onClick={() => onEditRepayment(loan.id, r.id)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 p-0.5" title="Edit">
                                      <Edit3 size={12} />
                                    </button>
                                  )}
                                  {onDeleteRepayment && (
                                    <button onClick={() => onDeleteRepayment(loan.id, r.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 p-0.5" title="Delete">
                                      <XIcon size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 dark:bg-gray-700 font-bold">
                <td colSpan={5} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-gray-800 dark:text-gray-200 text-right">
                  Total ({filteredLoans.length} records):
                </td>
                <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-red-600 dark:text-red-400 text-right font-bold">-{formatPKR(totalAmountPKR)}</td>
                <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-red-600 dark:text-red-400 text-right font-bold">-{formatUSD(totalAmount)}</td>
                <td colSpan={3} className="border border-gray-400 dark:border-gray-500"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default LoanList;
