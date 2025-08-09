import React, { useMemo, useState } from 'react';
import { Plus, Trash2, DollarSign, Calendar, CreditCard, Filter, User, FileText, Wallet, Download } from 'lucide-react';
import { Expense, Contact } from '../types';
import { formatCurrency, exportToCSV } from '../utils/helpers';
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
        }),
        Time: new Date(expense.date).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
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
      <div className="card">
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('date')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors"
                    >
                      <Calendar size={16} />
                      <span>Date</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors"
                    >
                      <DollarSign size={16} />
                      <span>Expense</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <div className="flex items-center gap-2">
                      <FileText size={16} />
                      <span>Description</span>
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      <span>Contact</span>
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('accountNumber')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors"
                    >
                      <CreditCard size={16} />
                      <span>Account</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('amount')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors"
                    >
                      <DollarSign size={16} />
                      <span>Amount</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <div className="flex items-center gap-2">
                      <Wallet size={16} />
                      <span>Balance After</span>
                    </div>
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedExpenses.map((expense) => {
                  const contactName = getContactName(expense.accountNumber);
                  return (
                    <tr
                      key={expense.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-danger-100 rounded-lg">
                            <DollarSign className="text-danger-600" size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {new Date(expense.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(expense.date).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-medium text-gray-900">{expense.name}</p>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-gray-600 max-w-xs truncate" title={expense.description}>
                          {expense.description || '—'}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        {contactName ? (
                          <div className="flex items-center space-x-2">
                            <div className="p-1 bg-primary-100 rounded">
                              <User className="text-primary-600" size={12} />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{contactName}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <p className="font-mono text-sm text-gray-700">{expense.accountNumber}</p>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-semibold text-danger-600">
                            -{formatPKR(expense.amount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            ({formatUSD(expense.usdAmount)})
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-right md:text-left">
                          <p className="font-medium text-gray-900">
                            {formatCurrency(expense.currentBalance)}
                          </p>
                          {!isLoadingRate && (
                          <p className="text-xs text-gray-500">{formatPKR(pkrBalanceAfterById[expense.id] ?? 0)}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => onDelete(expense.id)}
                          className="text-danger-600 hover:text-danger-700 p-2 rounded-lg hover:bg-danger-50 transition-colors"
                          title="Delete expense"
                        >
                          <Trash2 size={16} />
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