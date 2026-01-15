import React, { useMemo, useState } from 'react';
import { Plus, Trash2, DollarSign, Filter, Download, ChevronUp, ChevronDown, X, Edit } from 'lucide-react';
import { Expense, Contact } from '../types';
import { formatCurrency, exportToCSV, formatPKRDate, formatPKRTime } from '../utils/helpers';
import { formatPKR, formatUSD } from '../utils/currencyConverter';
import { sendAudit } from '../utils/audit';

interface ExpenseListProps {
  expenses: Expense[];
  contacts: Contact[];
  onDelete: (id: string) => void;
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
}

const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, contacts, onDelete, onAddExpense, onEditExpense }) => {
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
      const expensesLocal = expenses;
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

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    if (selectedMonth !== 'all') {
      const expenseMonth = new Date(expense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (expenseMonth !== selectedMonth) return false;
    }
    if (selectedContact !== 'all') {
      const contact = contacts.find(c => c.id === selectedContact);
      if (contact && expense.accountNumber !== contact.accountNumber) return false;
    }
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
  const totalExpensesPKR = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const getContactName = (expense: Expense) => {
    // First try to find by contactId (more reliable)
    if (expense.contactId) {
      const contact = contacts.find(c => c.id === expense.contactId);
      if (contact) return contact.name;
    }
    // Fallback to account number for old records
    const contact = contacts.find(c => c.accountNumber === expense.accountNumber);
    return contact ? contact.name : null;
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No expenses to export');
      return;
    }
    const csvData = filteredExpenses.map(expense => {
      const contactName = getContactName(expense);
      return {
        Date: formatPKRDate(expense.date),
        Time: formatPKRTime(expense.date),
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
    if (sortBy !== field) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Track all your expenses</p>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={handleExportCSV} className="btn-secondary flex items-center text-sm py-1.5 px-3" disabled={filteredExpenses.length === 0}>
            <Download size={16} className="mr-1" />
            Export
          </button>
          <button onClick={onAddExpense} className="btn-primary flex items-center text-sm py-1.5 px-3">
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
        {expenseContacts.length > 0 && (
          <select value={selectedContact} onChange={(e) => setSelectedContact(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm">
            <option value="all">All Contacts</option>
            {expenseContacts.map((contact) => (<option key={contact.id} value={contact.id}>{contact.name}</option>))}
          </select>
        )}
        <span className="text-sm text-gray-600 dark:text-gray-400">From:</span>
        <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm" />
        <span className="text-sm text-gray-600 dark:text-gray-400">To:</span>
        <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-sm" />
        <button
          type="button"
          onClick={() => { 
            setSelectedMonth('all'); 
            setSelectedContact('all'); 
            setStartDate(''); 
            setEndDate(''); 
            setSortBy('date');
            setSortOrder('desc');
          }}
          className="flex items-center gap-1 px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-300 dark:border-red-600 rounded"
        >
          <X size={14} />
          Clear Filters
        </button>
      </div>

      {/* Excel-style Table */}
      {sortedExpenses.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
          <DollarSign className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No expenses found</h3>
          <button onClick={onAddExpense} className="btn-primary mt-4">Add Expense</button>
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
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Expense Name<SortIcon field="name" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Description</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Contact</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('accountNumber')}>
                  <div className="flex items-center">Account<SortIcon field="accountNumber" /></div>
                </th>
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
              {sortedExpenses.map((expense, index) => {
                const contactName = getContactName(expense);
                return (
                  <tr key={expense.id} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-center">{index + 1}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white whitespace-nowrap">{formatPKRDate(expense.date)}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatPKRTime(expense.date)}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white font-medium">{expense.name}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 max-w-[150px] truncate" title={expense.description || ''}>{expense.description || '—'}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white">{contactName || '—'}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 font-mono">{expense.accountNumber}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 text-right font-medium">-{formatPKR(expense.amount)}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 text-right">{formatUSD(expense.usdAmount)}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white text-right font-medium">{formatCurrency(expense.currentBalance)}</td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-right">
                      {!isLoadingRate && formatPKR(pkrBalanceAfterById[expense.id] ?? 0)}
                    </td>
                    <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => onEditExpense(expense)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1" title="Edit">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => onDelete(expense.id)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 dark:bg-gray-700 font-bold">
                <td colSpan={7} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-gray-800 dark:text-gray-200 text-right">
                  Total ({filteredExpenses.length} records):
                </td>
                <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-red-600 dark:text-red-400 text-right font-bold">-{formatPKR(totalExpensesPKR)}</td>
                <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-red-600 dark:text-red-400 text-right font-bold">{formatUSD(totalExpenses)}</td>
                <td colSpan={3} className="border border-gray-400 dark:border-gray-500"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExpenseList;
