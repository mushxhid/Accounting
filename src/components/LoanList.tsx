import React, { useMemo, useState } from 'react';
import { Plus, Trash2, UserCheck, Calendar, Filter, Download, Wallet, ChevronDown, ChevronRight, Edit3, X } from 'lucide-react';
import { Loan } from '../types';
import { formatCurrency, exportToCSV } from '../utils/helpers';
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
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'partnerName'>('partnerName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Exact PKR balance-after reconstruction
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

  // Get unique months from loans
  const months = useMemo(() => {
    const monthSet = new Set<string>();
    loans.forEach(loan => {
      const date = new Date(loan.date);
      const monthYear = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      monthSet.add(monthYear);
    });
    return Array.from(monthSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [loans]);

  // Filter loans by selected month
  const filteredLoans = useMemo(() => {
    const base = loans.filter(loan => {
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
    return base;
  }, [loans, selectedMonth]);

  // Sort filtered loans
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

  const handleExportCSV = () => {
    if (filteredLoans.length === 0) {
      alert('No loans to export');
      return;
    }

    // Prepare data for CSV export
    const csvData: any[] = [];
    filteredLoans.forEach(loan => {
      // Parent loan row
      csvData.push({
        Type: 'Loan',
        Date: new Date(loan.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
        Time: new Date(loan.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        'Partner Name': loan.partnerName,
        'Amount (PKR)': (-loan.amount).toFixed(2),
        'Amount (USD)': (-loan.usdAmount).toFixed(2),
        Description: loan.description || '',
        'Balance After (USD)': loan.currentBalance.toFixed(2)
      });
      // Repayment rows
      (loan.repayments || []).forEach(r => {
        csvData.push({
          Type: 'Repayment',
          Date: new Date(r.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }),
          Time: new Date(r.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
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

  const totalLoans = filteredLoans.length;
  const totalAmount = filteredLoans.reduce((sum, loan) => sum + loan.usdAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner Loans</h1>
          <p className="text-gray-600 mt-1">
            {totalLoans} loan{totalLoans !== 1 ? 's' : ''} • Total: {formatCurrency(totalAmount)}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="btn-secondary flex items-center"
            disabled={filteredLoans.length === 0}
          >
            <Download size={20} className="mr-2" />
            Export CSV
          </button>
          <button
            onClick={onAddLoan}
            className="btn-primary flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Add Loan
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter:</span>
          </div>
          
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Months</option>
            {months.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>

          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Date:</span>
            <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            <span className="text-sm text-gray-500">to</span>
            <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      </div>

      {/* Loans List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {sortedLoans.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loans found</h3>
            <p className="text-gray-600">
              {selectedMonth === 'all' 
                ? 'No partner loans have been added yet.' 
                : `No loans found for ${selectedMonth}.`
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('partnerName')}
                  >
                    <div className="flex items-center space-x-1">
                      <UserCheck size={14} />
                      <span>Partner</span>
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center space-x-1">
                      <Calendar size={14} />
                      <span>Date</span>
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('amount')}
                  >
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance After
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedLoans.map((loan) => {
                  const principalPKR = loan.principalAmount ?? loan.amount + (loan.repayments?.reduce((s, r) => s + r.amount, 0) ?? 0);
                  // principalUSD available if needed later
                  // Remaining shown beneath progress via current outstanding (loan.amount/usdAmount)
                  const paidRatio = principalPKR > 0 ? 1 - (loan.amount / principalPKR) : 0;
                  const isOpen = !!expanded[loan.id];
                  return (
                  <React.Fragment key={loan.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(loan.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {loan.partnerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div>
                        <p className="text-danger-600 font-medium">
                          -{formatPKR(loan.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          ({formatUSD(loan.usdAmount)})
                        </p>
                        <div className="mt-2">
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-1.5 bg-warning-500" style={{ width: `${Math.min(100, Math.max(0, paidRatio * 100))}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                            <span>Remaining: {formatPKR(loan.amount)}</span>
                            <span>({formatUSD(loan.usdAmount)})</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {loan.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="text-right md:text-left">
                        <p>{formatCurrency(loan.currentBalance)}</p>
                        <p className="text-xs text-gray-500">{formatPKR(pkrBalanceAfterById[loan.id] ?? 0)}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="inline-flex items-center space-x-3">
                        <button
                          onClick={() => setExpanded(prev => ({ ...prev, [loan.id]: !prev[loan.id] }))}
                          className="text-gray-600 hover:text-gray-800 transition-colors"
                          title={isOpen ? 'Hide repayments' : 'Show repayments'}
                        >
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        <button
                          onClick={() => onOpenRepay(loan.id)}
                          className="text-success-600 hover:text-success-700 transition-colors"
                          title="Record repayment"
                        >
                          <Wallet size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(loan.id)}
                          className="text-danger-600 hover:text-danger-900 transition-colors"
                          title="Delete loan"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        {(loan.repayments && loan.repayments.length > 0) ? (
                          <div className="space-y-3">
                            {loan.repayments.map((r) => (
                              <div key={r.id} className="flex items-start justify-between p-3 bg-white rounded border border-gray-200">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{new Date(r.date).toLocaleDateString()}</div>
                                  <div className="text-xs text-gray-500">{r.description || '-'}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-success-600 font-medium">+{formatPKR(r.amount)}</div>
                                  <div className="text-xs text-gray-500">({formatUSD(r.usdAmount)})</div>
                                  <div className="flex items-center justify-end space-x-2 mt-1">
                                    {onEditRepayment && (
                                      <button className="text-primary-600 hover:text-primary-700" title="Edit repayment" onClick={() => onEditRepayment(loan.id, r.id)}>
                                        <Edit3 size={14} />
                                      </button>
                                    )}
                                    {onDeleteRepayment && (
                                      <button className="text-danger-600 hover:text-danger-700" title="Delete repayment" onClick={() => onDeleteRepayment(loan.id, r.id)}>
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No repayments yet.</div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanList;
