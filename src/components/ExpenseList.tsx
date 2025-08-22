import React, { useMemo, useState } from 'react';
import { Plus, Trash2, DollarSign, Calendar, CreditCard, Filter, User, FileText, Wallet, Download, Eye, X } from 'lucide-react';
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
    // For now, this will toggle the description expansion
    // You can extend this to show more detailed information in a modal or expand the row
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

  // not using live rate; PKR balance-after is reconstructed exactly

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
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600 mt-1">Track all your Amazon agency expenses</p>
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
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-danger-100 rounded-lg">
              <DollarSign className="text-danger-600" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalExpenses)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Filtered Expenses</p>
            <p className="text-lg font-semibold text-gray-900">
              {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Filter size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filter:</span>
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
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as ['date' | 'amount' | 'name' | 'accountNumber', 'asc' | 'desc'];
                setSortBy(field);
                setSortOrder(order);
              }}
              className="input-field"
            >
              <option value="date-desc">Date (Newest)</option>
              <option value="date-asc">Date (Oldest)</option>
              <option value="amount-desc">Amount (High to Low)</option>
              <option value="amount-asc">Amount (Low to High)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="accountNumber-asc">Account (A-Z)</option>
              <option value="accountNumber-desc">Account (Z-A)</option>
            </select>
          </div>
          <div className="flex items-center space-x-2 pt-4 lg:pt-0">
            <span className="text-sm font-medium text-gray-700">Date:</span>
            <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="input-field" />
            <span className="text-sm text-gray-500">to</span>
            <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="input-field" />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card-wide">
        {sortedExpenses.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedMonth !== 'all' || selectedContact !== 'all' ? 'No expenses found' : 'No expenses yet'}
            </h3>
            <p className="text-gray-600 mb-6">
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
          <div className="expense-table-container w-full">
            <table className="expense-table w-full table-fixed">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-4 px-3 font-semibold text-gray-700 bg-gray-50 w-32">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors w-full"
                    >
                      <Calendar size={16} />
                      <span>Date</span>
                    </button>
                  </th>
                  <th className="text-left py-4 px-3 font-semibold text-gray-700 bg-gray-50">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors w-full"
                    >
                      <DollarSign size={16} />
                      <span>Expense</span>
                    </button>
                  </th>
                  <th className="text-left py-4 px-3 font-semibold text-gray-700 bg-gray-50 w-40">
                    <div className="flex items-center gap-2">
                      <FileText size={16} />
                      <span>Description</span>
                    </div>
                  </th>
                  <th className="text-left py-4 px-3 font-semibold text-gray-700 bg-gray-50 w-36">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      <span>Contact</span>
                    </div>
                  </th>
                  <th className="text-left py-4 px-3 font-semibold text-gray-700 bg-gray-50 w-40">
                    <button
                      onClick={() => handleSort('accountNumber')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors w-full"
                    >
                      <CreditCard size={16} />
                      <span>Account</span>
                    </button>
                  </th>
                  <th className="text-left py-4 px-3 font-semibold text-gray-700 bg-gray-50 w-28">
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors w-full"
                    >
                      <DollarSign size={16} />
                      <span>Amount</span>
                    </button>
                  </th>
                  <th className="text-left py-4 px-3 font-semibold text-gray-700 bg-gray-50 w-36">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} />
                      <span>Balance After</span>
                    </div>
                  </th>
                  <th className="text-right py-4 px-3 font-semibold text-gray-700 bg-gray-50 w-16">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedExpenses.map((expense) => {
                  const contactName = getContactName(expense.accountNumber);
                  const isDescriptionExpanded = expandedDescriptions.has(expense.id);
                  return (
                    <tr
                      key={expense.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="py-3 px-3 align-top">
                        <div className="flex items-start space-x-2">
                          <div className="p-1 bg-danger-100 rounded flex-shrink-0 mt-0.5">
                            <DollarSign className="text-danger-600" size={12} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight whitespace-nowrap">
                              {formatPKRDate(expense.createdAt)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                              {formatPKRTime(expense.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="flex items-start space-x-2">
                          <button
                            onClick={() => handleViewExpense(expense)}
                            className="p-1.5 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors duration-150 flex-shrink-0 mt-0.5"
                            title={expandedDescriptions.has(expense.id) ? "Hide expense details" : "View expense details"}
                          >
                            {expandedDescriptions.has(expense.id) ? (
                              <X size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                          <p className="font-semibold text-gray-900 text-sm leading-tight break-words flex-1" title={expense.name}>
                            {expense.name}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600 leading-tight max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={expense.description || '—'}>
                            {expense.description || '—'}
                          </p>
                          {expense.description && expense.description.length > 25 && (
                            <button
                              onClick={() => toggleDescription(expense.id)}
                              className="text-primary-600 hover:text-primary-700 text-xs font-medium flex items-center gap-1 transition-colors"
                            >
                              {isDescriptionExpanded ? (
                                <>
                                  <X size={12} />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <span className="text-xs">Show more</span>
                                </>
                              )}
                            </button>
                          )}
                          {isDescriptionExpanded && expense.description && (
                            <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                              <p className="text-sm text-gray-700 leading-relaxed break-words">
                                {expense.description}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        {contactName ? (
                          <div className="flex items-start space-x-2">
                            <div className="p-1 bg-primary-100 rounded flex-shrink-0 mt-0.5">
                              <User className="text-primary-600" size={10} />
                            </div>
                            <span className="text-sm font-medium text-gray-900 break-words leading-tight max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={contactName}>
                              {contactName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 align-top">
                        <p className="font-mono text-sm text-gray-700 break-all leading-tight max-w-xs overflow-hidden text-ellipsis whitespace-nowrap" title={expense.accountNumber}>
                          {expense.accountNumber}
                        </p>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1">
                          <p className="font-bold text-danger-600 text-sm leading-tight whitespace-nowrap">
                            -{formatPKR(expense.amount)}
                          </p>
                          <p className="text-xs text-gray-500 leading-tight whitespace-nowrap">
                            ({formatUSD(expense.usdAmount)})
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-3 align-top">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900 text-sm leading-tight whitespace-nowrap">
                            {formatCurrency(expense.currentBalance)}
                          </p>
                          {!isLoadingRate && (
                          <p className="text-xs text-gray-500 leading-tight whitespace-nowrap">
                            {formatPKR(pkrBalanceAfterById[expense.id] ?? 0)}
                          </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right align-top">
                        <button
                          onClick={() => onDelete(expense.id)}
                          className="text-danger-600 hover:text-danger-700 p-1.5 rounded hover:bg-danger-50 transition-colors duration-150"
                          title="Delete expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseList; 