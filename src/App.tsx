import React, { useState, useEffect } from 'react';
import { Home, List, Plus, TrendingUp, RotateCcw, Users, UserCheck } from 'lucide-react';
import { Expense, Debit, Contact, Loan, ExpenseFormData, DebitFormData, ContactFormData, LoanFormData, LoanRepaymentFormData, LoanRepayment } from './types';
import LoanRepaymentForm from './components/LoanRepaymentForm';
import { generateId } from './utils/helpers';
import Dashboard from './components/Dashboard';
import ExpenseList from './components/ExpenseList';
import DebitList from './components/DebitList';
import LoanList from './components/LoanList';
import ContactsPage from './components/ContactsPage';
import ExpenseForm from './components/ExpenseForm';
import DebitForm from './components/DebitForm';
import LoanForm from './components/LoanForm';
import ContactForm from './components/ContactForm';
import { observeAuth, logout, getOrgIdForUser } from './utils/auth';
import {
  startRealtimeSync,
  upsertExpense as dbUpsertExpense,
  deleteExpense as dbDeleteExpense,
  upsertDebit as dbUpsertDebit,
  deleteDebit as dbDeleteDebit,
  upsertLoan as dbUpsertLoan,
  deleteLoan as dbDeleteLoan,
  setBalance as dbSetBalance,
  upsertContact as dbUpsertContact,
  deleteContact as dbDeleteContact,
  migrateUserToOrgIfEmpty,
    clearOrgData,
  appendRepayment,
    clearAllLegacyUsersData,
} from './utils/db';
import { sendAudit } from './utils/audit';

const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debits, setDebits] = useState<Debit[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'expenses' | 'credits' | 'loans' | 'contacts'>('dashboard');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showDebitForm, setShowDebitForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [repayLoanId, setRepayLoanId] = useState<string | null>(null);
  const [editingRepayment, setEditingRepayment] = useState<{ loanId: string; repaymentId: string } | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0); // Reset to 0
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [orgId, setOrgId] = useState<string>('');
  const [authReady, setAuthReady] = useState<boolean>(false);

  useEffect(() => {
    if (authReady) {
      console.log('[Auth] orgId =', orgId, 'email =', currentUserEmail);
    }
  }, [authReady, orgId, currentUserEmail]);

  // Auth listener and Firestore sync
  useEffect(() => {
    let stopSync: (() => void) | null = null;
    const unsub = observeAuth((u) => {
      setCurrentUserEmail(u?.email || '');
      setCurrentUserId(u?.uid || '');
      // Friendly name for header
      const email = (u?.email || '').toLowerCase();
      let name = (u as any)?.displayName as string | undefined;
      if (!name || name.trim() === '') {
        if (email === 'mushahidyaseen56@gmail.com') name = 'Mushahid';
        else if (email === 'rizwanelahi481@gmail.com') name = 'Rizwan';
        else if (email.includes('@')) name = email.split('@')[0];
      }
      setCurrentUserName(name || '');
      const newOrgId = getOrgIdForUser(u);
      setOrgId(newOrgId);
      setAuthReady(true);
      if (stopSync) { stopSync(); stopSync = null; }
      if (newOrgId) {
        stopSync = startRealtimeSync(newOrgId, {
          onExpenses: setExpenses,
          onDebits: setDebits,
          onLoans: setLoans,
          onContacts: setContacts,
          onBalance: setCurrentBalance,
        });
      }
    });
    return () => { unsub(); if (stopSync) stopSync(); };
  }, []);

  // When using shared org, force-clear any old local cache to avoid stale re-appearing entries
  useEffect(() => {
    if (!authReady) return;
    if (!orgId) return;
    localStorage.removeItem('amazon-agency-expenses');
    localStorage.removeItem('amazon-agency-debits');
    localStorage.removeItem('amazon-agency-loans');
    localStorage.removeItem('amazon-agency-contacts');
    localStorage.removeItem('amazon-agency-balance');
  }, [authReady, orgId]);

  // Persist balance only to Firestore when org is active
  useEffect(() => {
    if (!orgId) return;
    dbSetBalance(orgId, currentBalance);
  }, [currentBalance, orgId]);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset everything? This will:\n\n• Set balance to $0\n• Delete all expenses\n• Delete all income\n• Delete all loans\n• Delete all contacts\n\nThis action cannot be undone.')) {
      setExpenses([]);
      setDebits([]);
      setLoans([]);
      setContacts([]);
      setCurrentBalance(0);

      // Clear local cache for offline mode
      localStorage.removeItem('amazon-agency-expenses');
      localStorage.removeItem('amazon-agency-debits');
      localStorage.removeItem('amazon-agency-loans');
      localStorage.removeItem('amazon-agency-contacts');
      localStorage.setItem('amazon-agency-balance', '0');

      // Clear shared org data in Firestore so both admins see reset
      if (orgId) {
        clearOrgData(orgId)
          .then(() => console.log('[Reset] org cleared'))
          .catch(() => {/* already logged in db util */});
        // Safety: also clear legacy per-user collections to avoid resurrection from old clients
        clearAllLegacyUsersData();
      }
    }
  };

  const handleAddExpense = (formData: ExpenseFormData) => {
    // Calculate the new current balance (using USD amount for balance calculations)
    const usdAmount = parseFloat(formData.usdAmount) || 0;
    console.log('[AddExpense] orgId =', orgId, 'usd =', usdAmount);
    const newBalance = currentBalance - usdAmount;

    const newExpense: Expense = {
      id: generateId(),
      name: formData.name,
      amount: parseFloat(formData.amount), // PKR amount
      usdAmount: usdAmount, // USD amount
      accountNumber: formData.accountNumber,
      date: formData.date,
      description: formData.description,
      currentBalance: newBalance,
      createdBy: { uid: currentUserId, email: currentUserEmail },
      updatedBy: { uid: currentUserId, email: currentUserEmail },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setExpenses(prev => [newExpense, ...prev]);
    setCurrentBalance(newBalance);
    if (orgId) { dbUpsertExpense(orgId, newExpense); dbSetBalance(orgId, newBalance); } else { console.warn('[AddExpense] Missing orgId, write skipped'); }
    sendAudit({ action: 'create', entity: 'expense', details: { id: newExpense.id, name: newExpense.name, amount: newExpense.amount } });
    setShowExpenseForm(false);
  };

  const handleAddDebit = (formData: DebitFormData) => {
    // Calculate the new current balance (using USD amount for balance calculations)
    const usdAmount = parseFloat(formData.usdAmount) || 0;
    console.log('[AddDebit] orgId =', orgId, 'usd =', usdAmount);
    const newBalance = currentBalance + usdAmount;

    const newDebit: Debit = {
      id: generateId(),
      amount: parseFloat(formData.amount), // PKR amount
      usdAmount: usdAmount, // USD amount
      source: formData.source,
      date: formData.date,
      description: formData.description,
      currentBalance: newBalance,
      createdBy: { uid: currentUserId, email: currentUserEmail },
      updatedBy: { uid: currentUserId, email: currentUserEmail },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDebits(prev => [newDebit, ...prev]);
    setCurrentBalance(newBalance);
    if (orgId) { dbUpsertDebit(orgId, newDebit); dbSetBalance(orgId, newBalance); } else { console.warn('[AddDebit] Missing orgId, write skipped'); }
    sendAudit({ action: 'create', entity: 'debit', details: { id: newDebit.id, amount: newDebit.amount, source: newDebit.source } });
    setShowDebitForm(false);
  };

  const handleAddLoan = (formData: LoanFormData) => {
    // Calculate the new current balance (loans reduce the balance, using USD amount)
    const usdAmount = parseFloat(formData.usdAmount) || 0;
    console.log('[AddLoan] orgId =', orgId, 'usd =', usdAmount);
    const newBalance = currentBalance - usdAmount;

    const newLoan: Loan = {
      id: generateId(),
      partnerName: formData.partnerName,
      amount: parseFloat(formData.amount), // PKR amount (outstanding)
      usdAmount: usdAmount, // USD amount (outstanding)
      principalAmount: parseFloat(formData.amount),
      principalUSDAmount: usdAmount,
      date: formData.date,
      repayments: [],
      description: formData.description,
      currentBalance: newBalance,
      createdBy: { uid: currentUserId, email: currentUserEmail },
      updatedBy: { uid: currentUserId, email: currentUserEmail },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setLoans(prev => [newLoan, ...prev]);
    setCurrentBalance(newBalance);
    if (orgId) { dbUpsertLoan(orgId, newLoan); dbSetBalance(orgId, newBalance); } else { console.warn('[AddLoan] Missing orgId, write skipped'); }
    sendAudit({ action: 'create', entity: 'loan', details: { id: newLoan.id, partnerName: newLoan.partnerName, amount: newLoan.amount } });
    setShowLoanForm(false);
  };

  const handleRepayLoan = (loanId: string, data: LoanRepaymentFormData) => {
    // Convert PKR to USD using the same conversion stored in forms: usdAmount is already provided/derived by form
    const usdAmount = parseFloat(data.usdAmount || '0');
    const pkrAmount = parseFloat(data.amount || '0');
    if (usdAmount <= 0 || pkrAmount <= 0) return;

    const newBalance = currentBalance + usdAmount; // repayments increase USD balance
    setCurrentBalance(newBalance);

    let updatedLoanForDb: Loan | null = null;
    const repayment: LoanRepayment = {
      id: generateId(),
      loanId,
      amount: pkrAmount,
      usdAmount: usdAmount,
      date: data.date,
      description: data.description,
      createdBy: { uid: currentUserId, email: currentUserEmail },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setLoans(prev => prev.map(loan => {
      if (loan.id !== loanId) return loan;
      const updatedLoan: Loan = {
        ...loan,
        amount: Math.max(0, loan.amount - pkrAmount),
        usdAmount: Math.max(0, loan.usdAmount - usdAmount),
        currentBalance: newBalance,
        repayments: [...(loan.repayments || []), repayment],
        updatedAt: new Date().toISOString(),
      };
      updatedLoanForDb = updatedLoan;
      return updatedLoan;
    }));
    if (orgId) {
      appendRepayment(orgId, loanId, repayment).catch(() => dbUpsertLoan(orgId, updatedLoanForDb!));
      dbSetBalance(orgId, newBalance);
    } else { console.warn('[RepayLoan] Missing orgId'); }
    sendAudit({ action: 'create', entity: 'repayment', details: { loanId, amount: pkrAmount } });
  };

  const openRepayModal = (loanId: string) => {
    setRepayLoanId(loanId);
    setEditingRepayment(null);
  };

  const closeRepayModal = () => {
    setRepayLoanId(null);
    setEditingRepayment(null);
  };

  const handleAddContact = (formData: ContactFormData) => {
    const newContact: Contact = {
      id: generateId(),
      name: formData.name,
      accountNumber: formData.accountNumber,
      description: formData.description,
      createdBy: { uid: currentUserId, email: currentUserEmail },
      updatedBy: { uid: currentUserId, email: currentUserEmail },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setContacts(prev => [newContact, ...prev]);
    if (orgId) dbUpsertContact(orgId, newContact);
    sendAudit({ action: 'create', entity: 'contact', details: { id: newContact.id, name: newContact.name } });
    setShowContactForm(false);
    setEditingContact(null);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowContactForm(true);
  };

  const handleUpdateContact = (formData: ContactFormData) => {
    if (editingContact) {
      const updatedContact: Contact = {
        ...editingContact,
        name: formData.name,
        accountNumber: formData.accountNumber,
        description: formData.description,
        updatedBy: { uid: currentUserId, email: currentUserEmail },
        updatedAt: new Date().toISOString(),
      };

      setContacts(prev => prev.map(contact => 
        contact.id === editingContact.id ? updatedContact : contact
      ));
      setShowContactForm(false);
      setEditingContact(null);
    }
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      const expenseToDelete = expenses.find(expense => expense.id === id);
      if (expenseToDelete) {
        // Add back the expense USD amount to the balance
        setCurrentBalance(prev => prev + expenseToDelete.usdAmount);
      }
      setExpenses(prev => prev.filter(expense => expense.id !== id));
      if (orgId) dbDeleteExpense(orgId, id);
      sendAudit({ action: 'delete', entity: 'expense', details: { id } });
    }
  };

  const handleDeleteDebit = (id: string) => {
    if (window.confirm('Are you sure you want to delete this income?')) {
      const debitToDelete = debits.find(debit => debit.id === id);
      if (debitToDelete) {
        // Subtract the debit USD amount from the balance
        setCurrentBalance(prev => prev - debitToDelete.usdAmount);
      }
      setDebits(prev => prev.filter(debit => debit.id !== id));
      if (orgId) dbDeleteDebit(orgId, id);
      sendAudit({ action: 'delete', entity: 'debit', details: { id } });
    }
  };

  const handleDeleteLoan = (id: string) => {
    if (window.confirm('Are you sure you want to delete this loan?')) {
      const loanToDelete = loans.find(loan => loan.id === id);
      if (loanToDelete) {
        // Add back the loan USD amount to the balance (since loans reduce balance)
        setCurrentBalance(prev => prev + loanToDelete.usdAmount);
      }
      setLoans(prev => prev.filter(loan => loan.id !== id));
      if (orgId) dbDeleteLoan(orgId, id);
      sendAudit({ action: 'delete', entity: 'loan', details: { id } });
    }
  };

  const handleDeleteContact = (id: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      setContacts(prev => prev.filter(contact => contact.id !== id));
      if (orgId) dbDeleteContact(orgId, id);
    sendAudit({ action: 'delete', entity: 'contact', details: { id } });
    }
  };

  const handleUpdateBalance = (newBalance: number) => {
    setCurrentBalance(newBalance);
    
    // Update all existing expenses, debits, and loans to reflect the new balance
    if (expenses.length > 0 || debits.length > 0 || loans.length > 0) {
      // Combine and sort all transactions by date
      const allTransactions = [
        ...expenses.map(exp => ({ ...exp, type: 'expense' as const })),
        ...debits.map(deb => ({ ...deb, type: 'debit' as const })),
        ...loans.map(loan => ({ ...loan, type: 'loan' as const }))
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let runningBalance = newBalance;
      const updatedExpenses: Expense[] = [];
      const updatedDebits: Debit[] = [];
      const updatedLoans: Loan[] = [];

      allTransactions.forEach(transaction => {
        if (transaction.type === 'expense') {
          runningBalance -= transaction.usdAmount;
          updatedExpenses.push({
            ...transaction,
            currentBalance: runningBalance
          });
        } else if (transaction.type === 'debit') {
          runningBalance += transaction.usdAmount; // Use usdAmount for balance
          updatedDebits.push({
            ...transaction,
            currentBalance: runningBalance
          });
        } else { // type === 'loan'
          runningBalance -= transaction.usdAmount; // Use usdAmount for balance
          updatedLoans.push({
            ...transaction,
            currentBalance: runningBalance
          });
        }
      });

      setExpenses(updatedExpenses);
      setDebits(updatedDebits);
      setLoans(updatedLoans);
    }
  };

  const openExpenseForm = () => {
    setShowExpenseForm(true);
  };

  const openDebitForm = () => {
    setShowDebitForm(true);
  };

  const openLoanForm = () => {
    setShowLoanForm(true);
  };

  const openContactForm = () => {
    setEditingContact(null);
    setShowContactForm(true);
  };

  const closeExpenseForm = () => {
    setShowExpenseForm(false);
  };

  const closeDebitForm = () => {
    setShowDebitForm(false);
  };

  const closeLoanForm = () => {
    setShowLoanForm(false);
  };

  const closeContactForm = () => {
    setShowContactForm(false);
    setEditingContact(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">eCom Gliders account</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {currentUserName && (
                <div className="hidden sm:flex items-center px-3 py-1 rounded-lg bg-gray-100 text-gray-700 text-sm">
                  {currentUserName}
                </div>
              )}
              <button
                onClick={() => logout()}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title="Sign out"
              >
                Sign out
              </button>
              <button
                onClick={handleReset}
                className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-danger-600 hover:text-danger-700 hover:bg-danger-50 transition-colors"
                title="Reset everything"
              >
                <RotateCcw size={16} className="mr-2" />
                Reset
              </button>
              
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'dashboard'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Home size={16} className="mr-2" />
                Dashboard
              </button>
              
              <button
                onClick={() => setCurrentView('expenses')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'expenses'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List size={16} className="mr-2" />
                Expenses
              </button>

              <button
                onClick={() => setCurrentView('credits')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'credits'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <TrendingUp size={16} className="mr-2" />
                Income
              </button>

              <button
                onClick={() => setCurrentView('loans')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'loans'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserCheck size={16} className="mr-2" />
                Loans
              </button>

              <button
                onClick={() => setCurrentView('contacts')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'contacts'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users size={16} className="mr-2" />
                Contacts
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' ? (
          <Dashboard 
            expenses={expenses} 
            debits={debits}
            loans={loans}
            currentBalance={currentBalance}
            onAddExpense={() => openExpenseForm()} 
            onAddDebit={() => openDebitForm()}
            onDeleteExpense={handleDeleteExpense}
            onDeleteDebit={handleDeleteDebit}
            onDeleteLoan={handleDeleteLoan}
            onUpdateBalance={handleUpdateBalance}
            onNavigate={(view) => setCurrentView(view)}
          />
        ) : currentView === 'expenses' ? (
          <ExpenseList 
            expenses={expenses}
            contacts={contacts}
            onDelete={handleDeleteExpense}
            onAddExpense={() => openExpenseForm()}
          />
        ) : currentView === 'credits' ? (
          <DebitList 
            debits={debits}
            onDelete={handleDeleteDebit}
            onAddDebit={() => openDebitForm()}
          />
        ) : currentView === 'loans' ? (
          <LoanList 
            loans={loans}
            onDelete={handleDeleteLoan}
            onAddLoan={() => openLoanForm()}
            onOpenRepay={openRepayModal}
            onEditRepayment={(loanId, repaymentId) => {
              setRepayLoanId(loanId);
              setEditingRepayment({ loanId, repaymentId });
            }}
            onDeleteRepayment={(loanId, repaymentId) => {
              const loan = loans.find(l => l.id === loanId);
              const repayment = loan?.repayments?.find(r => r.id === repaymentId);
              if (!loan || !repayment) return;
              if (!window.confirm('Delete this repayment?')) return;
              const newBalance = currentBalance - repayment.usdAmount;
              setCurrentBalance(newBalance);
              const updatedRepayments = (loan.repayments || []).filter(r => r.id !== repaymentId);
              const updatedLoan: Loan = {
                ...loan,
                usdAmount: loan.usdAmount + repayment.usdAmount,
                amount: loan.amount + repayment.amount,
                repayments: updatedRepayments,
                updatedAt: new Date().toISOString(),
              };
              setLoans(prev => prev.map(l => (l.id === loanId ? updatedLoan : l)));
              if (orgId) { dbUpsertLoan(orgId, updatedLoan); dbSetBalance(orgId, newBalance); }
            }}
          />
        ) : (
          <ContactsPage 
            contacts={contacts}
            onAddContact={() => openContactForm()}
            onDeleteContact={handleDeleteContact}
            onEditContact={handleEditContact}
          />
        )}
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col space-y-3">
        <button
          onClick={() => openDebitForm()}
          className="bg-success-600 hover:bg-success-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:shadow-xl"
          title="Add Money"
        >
          <Plus size={24} />
        </button>
        <button
          onClick={() => openExpenseForm()}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:shadow-xl"
          title="Add Expense"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <ExpenseForm
          onSubmit={handleAddExpense}
          onCancel={closeExpenseForm}
          contacts={contacts}
        />
      )}

      {/* Debit Form Modal */}
      {showDebitForm && (
        <DebitForm
          onSubmit={handleAddDebit}
          onCancel={closeDebitForm}
        />
      )}

      {/* Loan Form Modal */}
      {showLoanForm && (
        <LoanForm
          onSubmit={handleAddLoan}
          onCancel={closeLoanForm}
        />
      )}

      {repayLoanId && (
        (() => {
          const loan = loans.find(l => l.id === repayLoanId);
          if (!loan) return null;
          if (!editingRepayment) {
            return (
              <LoanRepaymentForm
                onSubmit={(data) => { handleRepayLoan(repayLoanId, data); closeRepayModal(); }}
                onCancel={closeRepayModal}
                maxPKR={loan.amount}
              />
            );
          }
          const repayment = loan.repayments?.find(r => r.id === editingRepayment.repaymentId);
          if (!repayment) return null;
          return (
            <LoanRepaymentForm
              onSubmit={(data) => {
                const oldUsd = repayment.usdAmount;
                const newUsd = parseFloat(data.usdAmount || '0');
                const oldPkr = repayment.amount;
                const newPkr = parseFloat(data.amount || '0');
                const deltaUsd = newUsd - oldUsd;
                setCurrentBalance(prev => prev + deltaUsd);
                const updatedRepayments = (loan.repayments || []).map(r => r.id === repayment.id ? { ...r, amount: newPkr, usdAmount: newUsd, date: data.date, description: data.description, updatedAt: new Date().toISOString() } : r);
                const usdOutstanding = Math.max(0, (loan.usdAmount + oldUsd) - newUsd);
                const pkrOutstanding = Math.max(0, (loan.amount + oldPkr) - newPkr);
                const updatedLoan: Loan = { ...loan, usdAmount: usdOutstanding, amount: pkrOutstanding, repayments: updatedRepayments, updatedAt: new Date().toISOString() };
                setLoans(prev => prev.map(l => (l.id === loan.id ? updatedLoan : l)));
                if (orgId) { dbUpsertLoan(orgId, updatedLoan); dbSetBalance(orgId, currentBalance + deltaUsd); }
                closeRepayModal();
              }}
              onCancel={closeRepayModal}
              maxPKR={loan.amount + repayment.amount}
              initialData={{ amount: String(repayment.amount), usdAmount: String(repayment.usdAmount), date: repayment.date, description: repayment.description || '' }}
              title="Edit Repayment"
              submitText="Update Repayment"
            />
          );
        })()
      )}

      {/* Contact Form Modal */}
      {showContactForm && (
        <ContactForm
          onSubmit={editingContact ? handleUpdateContact : handleAddContact}
          onCancel={closeContactForm}
        />
      )}
    </div>
  );
};

export default App; 