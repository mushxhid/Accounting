import React, { useState, useRef, useEffect } from 'react';
import { DollarSign, TrendingDown, Calendar, Trash2, Wallet, Edit, TrendingUp as TrendingUpIcon, UserCheck } from 'lucide-react';
import { Expense, Debit, Loan } from '../types';
import { calculateTotalExpenses } from '../utils/helpers';
import { formatPKR, formatUSD } from '../utils/currencyConverter';
import BalanceModal from './BalanceModal';
import DebitForm from './DebitForm';

interface DashboardProps {
  expenses: Expense[];
  debits: Debit[];
  loans: Loan[];
  currentBalance: number;
  onAddExpense: () => void;
  onAddDebit: () => void;
  onDeleteExpense: (id: string) => void;
  onDeleteDebit: (id: string) => void;
  onDeleteLoan: (id: string) => void;
  onUpdateBalance: (newBalance: number) => void;
  // New: handler to switch view in parent
  onNavigate?: (view: 'expenses' | 'credits' | 'loans') => void;
  audit?: any[];
}

const Dashboard: React.FC<DashboardProps> = ({ 
  expenses, 
  debits, 
  loans,
  currentBalance, 
  onAddExpense, 
  onAddDebit,
  onDeleteExpense, 
  onDeleteDebit,
  onDeleteLoan,
  onUpdateBalance,
  onNavigate,
  audit,
}) => {
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showDebitModal, setShowDebitModal] = useState(false);
  // We no longer fetch exchange rate here; all USD totals are stored as USD
  // and PKR totals are computed from original PKR amounts.

  // Calculate PKR equivalent of current balance based on original PKR amounts
  // This avoids rounding drift from converting USD back to PKR
  // and ensures exact values when users input PKR amounts.
  // We still fetch exchangeRate for other UI parts, but this value does not depend on it.
  
  const totalExpenses = calculateTotalExpenses(expenses);
  const totalIncome = debits.reduce((sum, debit) => sum + debit.usdAmount, 0);
  const totalLoans = loans.reduce((sum, loan) => sum + loan.usdAmount, 0);
  const monthlyExpenses = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.date);
      const currentDate = new Date();
      return expenseDate.getMonth() === currentDate.getMonth() && 
             expenseDate.getFullYear() === currentDate.getFullYear();
    })
    .reduce((total, expense) => total + expense.usdAmount, 0);

  // Calculate PKR totals using original PKR amounts (not converted from USD)
  const totalExpensesPKR = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const totalIncomePKR = debits.reduce((sum, debit) => sum + debit.amount, 0);
  const totalLoansPKR = loans.reduce((sum, loan) => sum + loan.amount, 0);
  const monthlyExpensesPKR = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.date);
      const currentDate = new Date();
      return expenseDate.getMonth() === currentDate.getMonth() && 
             expenseDate.getFullYear() === currentDate.getFullYear();
    })
    .reduce((total, expense) => total + expense.amount, 0);

  // Exact PKR balance derived from PKR transaction amounts
  const currentBalancePKRExact = totalIncomePKR - totalExpensesPKR - totalLoansPKR;

  // Get only current month expenses for recent expenses
  const currentMonthExpenses = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.date);
      const currentDate = new Date();
      return expenseDate.getMonth() === currentDate.getMonth() && 
             expenseDate.getFullYear() === currentDate.getFullYear();
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Get only current month debits for recent debits
  const currentMonthDebits = debits
    .filter(debit => {
      const debitDate = new Date(debit.date);
      const currentDate = new Date();
      return debitDate.getMonth() === currentDate.getMonth() && 
             debitDate.getFullYear() === currentDate.getFullYear();
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  // Get only current month loans for recent loans
  const currentMonthLoans = loans
    .filter(loan => {
      const loanDate = new Date(loan.date);
      const currentDate = new Date();
      return loanDate.getMonth() === currentDate.getMonth() && 
             loanDate.getFullYear() === currentDate.getFullYear();
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  const getCurrentMonthName = () => {
    const currentDate = new Date();
    return currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const handleUpdateBalance = (newBalance: number) => {
    onUpdateBalance(newBalance);
    setShowBalanceModal(false);
  };

  const handleAddDebit = () => {
    // This will be handled by the parent component
    setShowDebitModal(false);
  };

  const auditRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const handler = () => auditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.addEventListener('scrollToAudit' as any, handler);
    return () => window.removeEventListener('scrollToAudit' as any, handler);
  }, []);

  const auditList = (audit as any[]) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your Amazon agency expenses</p>
        </div>
      </div>

      {/* Current Balance Section */}
      <div className="bg-gradient-to-r from-success-500 to-success-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-lg">
              <Wallet className="text-white" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Current Balance</h2>
              <p className="text-success-100">Available funds after all transactions</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="mb-2">
                <p className="text-4xl font-bold">{formatUSD(currentBalance)}</p>
                <p className="text-lg font-semibold text-success-100">
                  {formatPKR(currentBalancePKRExact)}
                </p>
              </div>
              <p className="text-success-100 text-sm">
                {expenses.length} expense{expenses.length !== 1 ? 's' : ''} • {debits.length} income{debits.length !== 1 ? 's' : ''} • {loans.length} loan{loans.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowBalanceModal(true)}
              className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-colors"
              title="Update Balance"
            >
              <Edit className="text-white" size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-danger-100 rounded-lg">
              <DollarSign className="text-danger-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatUSD(totalExpenses)}
                </p>
                <p className="text-sm font-medium text-gray-600">
                  {formatPKR(totalExpensesPKR)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-success-100 rounded-lg">
              <TrendingUpIcon className="text-success-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatUSD(totalIncome)}
                </p>
                <p className="text-sm font-medium text-gray-600">
                  {formatPKR(totalIncomePKR)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Calendar className="text-primary-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatUSD(monthlyExpenses)}
                </p>
                <p className="text-sm font-medium text-gray-600">
                  {formatPKR(monthlyExpensesPKR)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-3 bg-warning-100 rounded-lg">
              <UserCheck className="text-warning-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Loans</p>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatUSD(totalLoans)}
                </p>
                <p className="text-sm font-medium text-gray-600">
                  {formatPKR(totalLoansPKR)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

             {/* Recent Transactions */}
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Recent Expenses */}
         <div className="card">
          <div className="flex items-center justify-between mb-6" onClick={() => onNavigate && onNavigate('expenses')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onNavigate && onNavigate('expenses'); } }}>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Recent Expenses</h2>
              <p className="text-sm text-gray-600 mt-1">{getCurrentMonthName()} only</p>
            </div>
            <button type="button" className="text-primary-600 hover:text-primary-700 font-medium text-sm" onClick={(e) => { e.stopPropagation(); console.log('[Nav] View All → expenses'); onNavigate && onNavigate('expenses'); }}>
              View All
            </button>
          </div>

          {currentMonthExpenses.length === 0 ? (
            <div className="text-center py-8">
              <TrendingDown className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses this month</h3>
              <p className="text-gray-600 mb-4">Start tracking your {getCurrentMonthName()} expenses</p>
              <button
                onClick={onAddExpense}
                className="btn-primary"
              >
                Add Your First Expense
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {currentMonthExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-danger-100 rounded-lg">
                      <DollarSign className="text-danger-600" size={16} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 break-words">{expense.name}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(expense.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div>
                        <p className="font-semibold text-danger-600">
                          -{formatPKR(expense.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          ({formatUSD(expense.usdAmount)})
                        </p>
                      </div>
                      <p className="text-sm text-gray-500">
                        Balance: {formatUSD(expense.currentBalance)} / {formatPKR(currentBalancePKRExact)}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteExpense(expense.id)}
                      className="text-danger-600 hover:text-danger-700 p-1 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Income */}
        <div className="card">
          <div className="flex items-center justify-between mb-6" onClick={() => onNavigate && onNavigate('credits')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onNavigate && onNavigate('credits'); } }}>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Recent Income</h2>
              <p className="text-sm text-gray-600 mt-1">{getCurrentMonthName()} only</p>
            </div>
            <button type="button" className="text-primary-600 hover:text-primary-700 font-medium text-sm" onClick={(e) => { e.stopPropagation(); console.log('[Nav] View All → credits'); onNavigate && onNavigate('credits'); }}>
              View All
            </button>
          </div>

          {currentMonthDebits.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUpIcon className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No income this month</h3>
              <p className="text-gray-600 mb-4">Add money to your balance</p>
              <button
                onClick={onAddDebit}
                className="btn-primary"
              >
                Add Money
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {currentMonthDebits.map((debit) => (
                <div
                  key={debit.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-success-100 rounded-lg">
                      <TrendingUpIcon className="text-success-600" size={16} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{debit.source}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(debit.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div>
                        <p className="font-semibold text-success-600">
                          +{formatPKR(debit.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          ({formatUSD(debit.usdAmount)})
                        </p>
                      </div>
                      <p className="text-sm text-gray-500">
                        Balance: {formatUSD(debit.currentBalance)} / {formatPKR(currentBalancePKRExact)}
                      </p>
                    </div>
                    <button
                      onClick={() => onDeleteDebit(debit.id)}
                      className="text-danger-600 hover:text-danger-700 p-1 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
                         </div>
           )}
         </div>

         {/* Recent Loans */}
         <div className="card">
           <div className="flex items-center justify-between mb-6" onClick={() => onNavigate && onNavigate('loans')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onNavigate && onNavigate('loans'); } }}>
             <div>
               <h2 className="text-xl font-semibold text-gray-900">Recent Loans</h2>
               <p className="text-sm text-gray-600 mt-1">{getCurrentMonthName()} only</p>
             </div>
             <button type="button" className="text-primary-600 hover:text-primary-700 font-medium text-sm" onClick={(e) => { e.stopPropagation(); console.log('[Nav] View All → loans'); onNavigate && onNavigate('loans'); }}>
               View All
             </button>
           </div>

           {currentMonthLoans.length === 0 ? (
             <div className="text-center py-8">
               <UserCheck className="mx-auto text-gray-400 mb-4" size={48} />
               <h3 className="text-lg font-medium text-gray-900 mb-2">No loans this month</h3>
               <p className="text-gray-600 mb-4">No partner loans recorded this month</p>
             </div>
           ) : (
             <div className="space-y-4">
               {currentMonthLoans.map((loan) => (
                 <div
                   key={loan.id}
                   className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                 >
                   <div className="flex items-center space-x-4">
                     <div className="p-2 bg-warning-100 rounded-lg">
                       <UserCheck className="text-warning-600" size={16} />
                     </div>
                     <div>
                       <h3 className="font-medium text-gray-900">{loan.partnerName}</h3>
                       <p className="text-sm text-gray-500">
                         {new Date(loan.date).toLocaleDateString()}
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center space-x-4">
                     <div className="text-right">
                       <div>
                         <p className="font-semibold text-warning-600">
                           -{formatPKR(loan.amount)}
                         </p>
                         <p className="text-xs text-gray-500">
                           ({formatUSD(loan.usdAmount)})
                         </p>
                       </div>
                        <p className="text-sm text-gray-500">
                          Balance: {formatUSD(loan.currentBalance)} / {formatPKR(currentBalancePKRExact)}
                        </p>
                     </div>
                     <button
                       onClick={() => onDeleteLoan(loan.id)}
                       className="text-danger-600 hover:text-danger-700 p-1 rounded transition-colors"
                       title="Delete"
                     >
                       <Trash2 size={16} />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </div>
       </div>

      {/* Balance Modal */}
      {showBalanceModal && (
        <BalanceModal
          currentBalance={currentBalance}
          onSubmit={handleUpdateBalance}
          onCancel={() => setShowBalanceModal(false)}
        />
      )}

      {/* Audit Log */}
      {Array.isArray(auditList) && (
        <div className="card mt-6" ref={auditRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Activity (both admins)</h2>
          </div>
          {auditList.length === 0 ? (
            <div className="text-sm text-gray-500">No recent activity.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-600">When</th>
                    <th className="px-4 py-2 text-left text-gray-600">Action</th>
                    <th className="px-4 py-2 text-left text-gray-600">Entity</th>
                    <th className="px-4 py-2 text-left text-gray-600">By</th>
                    <th className="px-4 py-2 text-left text-gray-600">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditList.map((e: any) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2">{new Date(e.timestamp || e._createdAt?.toDate?.() || Date.now()).toLocaleString()}</td>
                      <td className="px-4 py-2 font-medium">{e.action}</td>
                      <td className="px-4 py-2">{e.entity}</td>
                      <td className="px-4 py-2">{e.actor?.email || '-'}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {e.details ? (
                          <span>
                            {e.details.name ? `${e.details.name} ` : ''}
                            {typeof e.details.amountPKR === 'number' ? `PKR ${e.details.amountPKR.toLocaleString()} ` : ''}
                            {typeof e.details.amountUSD === 'number' ? `(USD ${e.details.amountUSD.toFixed(2)})` : ''}
                          </span>
                        ) : '-' }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Debit Modal */}
      {showDebitModal && (
        <DebitForm
          onSubmit={handleAddDebit}
          onCancel={() => setShowDebitModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard; 