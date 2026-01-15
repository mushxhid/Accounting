import React, { useMemo, useState } from 'react';
import { Plus, Trash2, DollarSign, Calendar, CreditCard, Filter, User, FileText, Wallet, Download, Eye, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Expense, Contact } from '../types';
import { formatCurrency, exportToCSV, formatPKRDate, formatPKRTime } from '../utils/helpers';
import { formatPKR, formatUSD } from '../utils/currencyConverter';
import { sendAudit } from '../utils/audit';

interface ExpenseListProps {
  expenses: Expense[];
  contacts: Contact[];
  onDelete: (id: string) => void;
  onAddExpense: () => void;
}

const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, contacts, onDelete, onAddExpense }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'name' | 'accountNumber'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoadingRate] = useState<boolean>(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  // Toggle description expansion
  const toggleDescription = (expenseId: string) => {
    const newExpanded = new Set(expandedDescriptions);
    if (newExpanded.has(expenseId)) {
      newExpanded.delete(expenseId);
    } else {
      newExpanded.add(expenseId);
    }
    setExpandedDescriptions(newExpanded);
  };

  // Handle viewing expense details
  const handleViewExpense = (expense: Expense) => {
    toggleDescription(expense.id);
  };

  // Build exact PKR balance-after map from all transactions in storage
  const pkrBalanceAfterById = useMemo(() => {
    try {
      const debits = JSON.parse(localStorage.getItem('amazon-agency-debits') || '[]');
      const loans = JSON.parse(localStorage.getItem('amazon-agency-loans') || '[]');
      const expensesLocal = expenses; // already provided
      const all = [
        ...expensesLocal.map((x) => ({ id: x.id, date: x.date, deltaPKR: -x.amount })),
        ...debits.map((x: any) => ({ id: x.id, date: x.date, deltaPKR: x.amount })),
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
  }, [expenses]);

  // Get unique months from expenses
  const months = expenses.reduce((acc, expense) => {
    const month = new Date(expense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!acc.includes(month)) {
      acc.push(month);
    }
    return acc;
  }, [] as string[]);

  // Get unique contacts from expenses (by account number)
  const expenseContacts = expenses.reduce((acc, expense) => {
    const contact = contacts.find(c => c.accountNumber === expense.accountNumber);
    if (contact && !acc.find(c => c.id === contact.id)) {
      acc.push(contact);
    }
    return acc;
  }, [] as Contact[]);

  // Filter expenses by selected month/contact and date range
  const filteredExpenses = expenses.filter(expense => {
    // Month filter
    if (selectedMonth !== 'all') {
      const expenseMonth = new Date(expense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (expenseMonth !== selectedMonth) return false;
    }

    // Contact filter
    if (selectedContact !== 'all') {
      const contact = contacts.find(c => c.id === selectedContact);
      if (contact && expense.accountNumber !== contact.accountNumber) return false;
    }

    // Date range filter (inclusive)
    const t = new Date(expense.date).getTime();
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

  // Sort expenses
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'accountNumber':
        comparison = a.accountNumber.localeCompare(b.accountNumber);
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: 'date' | 'amount' | 'name' | 'accountNumber') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.usdAmount, 0);
  const totalExpensesPKR = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const getContactName = (accountNumber: string) => {
    const contact = contacts.find(c => c.accountNumber === accountNumber);
    return contact ? contact.name : null;
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No expenses to export');
      return;
    }

    // Prepare data for CSV export
    const csvData = filteredExpenses.map(expense => {
      const contactName = getContactName(expense.accountNumber);
      return {
        Date: new Date(expense.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        , timeZone: 'Asia/Karachi'
        }),
        Time: new Date(expense.date).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Karachi'
        }),
        'Expense Name': expense.name,
        Description: expense.description || '',
        Contact: contactName || '',
        'Account Number': expense.accountNumber,
        'Amount (PKR)': expense.amount.toFixed(2),
        'Amount (USD)': expense.usdAmount.toFixed(2),
        'Balance After': expense.currentBalance.toFixed(2)
      };
    });

    const monthText = selectedMonth === 'all' ? 'All_Months' : selectedMonth.replace(/\s+/g, '_');
    const filename = `expenses_${monthText}_${new Date().toISOString().split('T')[0]}.csv`;
    
    exportToCSV(csvData, filename);
    sendAudit({ action: 'export', entity: 'expenses', details: { count: filteredExpenses.length, month: selectedMonth } });
  };

  const SortIcon = ({ field }: { field: 'date' | 'amount' | 'name' | 'accountNumber' }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Track all your Amazon agency expenses</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="btn-secondary flex items-center"
            disabled={filteredExpenses.length === 0}
          >
            <Download size={20} className="mr-2" />
            Export CSV
          </button>
          <button
            onClick={onAddExpense}
            className="btn-primary flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Stats Card */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
              <DollarSign className="text-danger-600 dark:text-danger-400" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPKR(totalExpensesPKR)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatUSD(totalExpenses)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400">Filtered Records</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card dark:bg-gray-800 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center space-x-2">
              <Filter size={16} className="text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
            </div>
            
            {/* Month Filter */}
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

            {/* Contact Filter */}
            {expenseContacts.length > 0 && (
              <select
                value={selectedContact}
                onChange={(e) => setSelectedContact(e.target.value)}
                className="input-field max-w-xs"
              >
                <option value="all">All Contacts</option>
                {expenseContacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
              <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="input-field w-auto" />
              <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
              <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="input-field w-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {sortedExpenses.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {selectedMonth !== 'all' || selectedContact !== 'all' ? 'No expenses found' : 'No expenses yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {selectedMonth !== 'all' || selectedContact !== 'all' 
                ? 'Try adjusting your filters.'
                : 'Start tracking your Amazon agency expenses.'
              }
            </p>
            {(selectedMonth === 'all' && selectedContact === 'all') && (
              <button
                onClick={onAddExpense}
                className="btn-primary"
              >
                Add Your First Expense
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <Calendar size={16} />
                      Date & Time
                      <SortIcon field="date" />
                    </button>
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      Expense Name
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText size={16} />
                      Description
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      Contact
                    </div>
                  </th>
                  <th className="text-left py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    <button
                      onClick={() => handleSort('accountNumber')}
                      className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <CreditCard size={16} />
                      Account
                      <SortIcon field="accountNumber" />
                    </button>
                  </th>
                  <th className="text-right py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors ml-auto"
                    >
                      Amount
                      <SortIcon field="amount" />
                    </button>
                  </th>
                  <th className="text-right py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm">
                    <div className="flex items-center gap-2 justify-end">
                      <Wallet size={16} />
                      Balance After
                    </div>
                  </th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-700 dark:text-gray-200 text-sm w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedExpenses.map((expense, index) => {
                  const contactName = getContactName(expense.accountNumber);
                  const isDescriptionExpanded = expandedDescriptions.has(expense.id);
                  const isEven = index % 2 === 0;
                  return (
                    <React.Fragment key={expense.id}>
                      <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isEven ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-800/50'}`}>
                        <td className="py-4 px-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPKRDate(expense.createdAt)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatPKRTime(expense.createdAt)}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewExpense(expense)}
                              className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors"
                              title={isDescriptionExpanded ? "Hide details" : "View details"}
                            >
                              {isDescriptionExpanded ? <X size={14} /> : <Eye size={14} />}
                            </button>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {expense.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={expense.description || '—'}>
                            {expense.description || '—'}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {contactName ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                              {contactName}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                            {expense.accountNumber}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="text-sm font-bold text-danger-600 dark:text-danger-400">
                            -{formatPKR(expense.amount)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {formatUSD(expense.usdAmount)}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(expense.currentBalance)}
                          </div>
                          {!isLoadingRate && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {formatPKR(pkrBalanceAfterById[expense.id] ?? 0)}
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            onClick={() => onDelete(expense.id)}
                            className="p-2 text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
                            title="Delete expense"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                      {/* Expanded description row */}
                      {isDescriptionExpanded && expense.description && (
                        <tr className="bg-gray-50 dark:bg-gray-700/30">
                          <td colSpan={8} className="py-3 px-4">
                            <div className="ml-8 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                <span className="font-medium text-gray-900 dark:text-white">Description:</span> {expense.description}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              {/* Table Footer with Totals */}
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-600">
                  <td colSpan={5} className="py-4 px-4 text-right font-semibold text-gray-700 dark:text-gray-200">
                    Total ({filteredExpenses.length} records):
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="text-sm font-bold text-danger-600 dark:text-danger-400">
                      -{formatPKR(totalExpensesPKR)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {formatUSD(totalExpenses)}
                    </div>
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseList;
