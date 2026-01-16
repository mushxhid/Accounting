  import React, { useState, useEffect } from 'react';
import { Home, List, Plus, TrendingUp, RotateCcw, Users, UserCheck, Activity, Menu, X } from 'lucide-react';
import { ThemeProvider } from './contexts/ThemeContext';
import { Expense, Debit, Contact, Loan, ExpenseFormData, DebitFormData, ContactFormData, LoanFormData, LoanRepaymentFormData, LoanRepayment } from './types';
import LoanRepaymentForm from './components/LoanRepaymentForm';
import { generateId, getPKRTimestamp } from './utils/helpers';
import Dashboard from './components/Dashboard';
import ExpenseList from './components/ExpenseList';
import DebitList from './components/DebitList';
import LoanList from './components/LoanList';
import ContactsPage from './components/ContactsPage';
import LogsPage from './components/LogsPage';
import ExpenseForm from './components/ExpenseForm';
import ExpenseEditForm from './components/ExpenseEditForm';
import DebitForm from './components/DebitForm';
import LoanForm from './components/LoanForm';
import ContactForm from './components/ContactForm';
import ThemeToggle from './components/ThemeToggle';
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
    clearOrgData,
  appendRepayment,
    clearAllLegacyUsersData,
    recordAuditEvent,
} from './utils/db';
import { sendAudit } from './utils/audit';

const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [debits, setDebits] = useState<Debit[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  // Initialize currentView from localStorage or default to 'dashboard'
  type ViewType = 'dashboard' | 'expenses' | 'credits' | 'loans' | 'contacts' | 'logs';
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem('currentView') as ViewType | null;
    if (savedView && (['dashboard', 'expenses', 'credits', 'loans', 'contacts', 'logs'] as ViewType[]).includes(savedView)) {
      return savedView;
    }
    return 'dashboard';
  });
  const [audit, setAudit] = useState<any[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showDebitForm, setShowDebitForm] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [repayLoanId, setRepayLoanId] = useState<string | null>(null);
  const [editingRepayment, setEditingRepayment] = useState<{ loanId: string; repaymentId: string } | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number>(0); // Reset to 0
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [orgId, setOrgId] = useState<string>('');
  const [authReady, setAuthReady] = useState<boolean>(false);

  // Save currentView to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('currentView', currentView);
  }, [currentView]);

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
          onAudit: setAudit,
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

  // Auto-recalculate USD balance from transactions to avoid stale or zero meta balance
  useEffect(() => {
    if (!orgId) return;
    const derived =
      debits.reduce((sum, d) => sum + (d.usdAmount || 0), 0) -
      expenses.reduce((sum, e) => sum + (e.usdAmount || 0), 0) -
      loans.reduce((sum, l) => sum + (l.usdAmount || 0), 0);
    if (Number.isFinite(derived) && Math.abs(derived - currentBalance) > 0.001) {
      setCurrentBalance(derived);
      dbSetBalance(orgId, derived);
    }
  }, [orgId, expenses, debits, loans]);

  // Migrate old expenses: clear wrong contactId and let user re-assign
  useEffect(() => {
    if (!orgId || contacts.length === 0 || expenses.length === 0) return;
    expenses.forEach(expense => {
      // If expense has contactId but that contact doesn't exist anymore, clear it
      if (expense.contactId) {
        const contactExists = contacts.find(c => c.id === expense.contactId);
        if (!contactExists) {
          const updatedExpense = { ...expense, contactId: undefined };
          dbUpsertExpense(orgId, updatedExpense);
        }
      }
    });
  }, [orgId, contacts, expenses]);

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

  const handleAddExpense = async (formData: ExpenseFormData) => {
    // Calculate the new current balance (using USD amount for balance calculations)
    const usdAmount = parseFloat(formData.usdAmount) || 0;
    console.log('[AddExpense] orgId =', orgId, 'usd =', usdAmount);
    const newBalance = currentBalance - usdAmount;

    // Clean up contactId - use undefined instead of empty string for proper Firestore handling
    const cleanContactId = formData.contactId && formData.contactId.trim() !== '' ? formData.contactId : undefined;
    
    const newExpense: Expense = {
      id: generateId(),
      name: formData.name,
      amount: parseFloat(formData.amount), // PKR amount
      usdAmount: usdAmount, // USD amount
      accountNumber: formData.accountNumber,
      contactId: cleanContactId,
      date: formData.date,
      description: formData.description || undefined,
      receiptImageUrl: formData.receiptImageUrl || undefined, // Cloudinary URL
      currentBalance: newBalance,
      createdBy: { uid: currentUserId, email: currentUserEmail },
      updatedBy: { uid: currentUserId, email: currentUserEmail },
      createdAt: getPKRTimestamp(),
      updatedAt: getPKRTimestamp(),
    };

    console.log('[AddExpense] Saving expense:', {
      id: newExpense.id,
      name: newExpense.name,
      contactId: newExpense.contactId,
      receiptImageUrl: newExpense.receiptImageUrl ? 'present' : 'missing'
    });

    // Save to Firestore first, then update local state
    if (orgId) {
      try {
        console.log('[AddExpense] Attempting to save to Firestore...', { orgId, expenseId: newExpense.id });
        await dbUpsertExpense(orgId, newExpense);
        console.log('[AddExpense] Expense saved to Firestore successfully');
        
        // Update balance separately
        try {
          await dbSetBalance(orgId, newBalance);
          console.log('[AddExpense] Balance updated successfully');
        } catch (balanceError) {
          console.warn('[AddExpense] Balance update failed (non-critical):', balanceError);
          // Continue even if balance update fails
        }
      } catch (error) {
        console.error('[AddExpense] Error saving to Firestore:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[AddExpense] Full error details:', {
          error,
          errorMessage,
          expense: newExpense,
          orgId
        });
        alert(`Failed to save expense to database: ${errorMessage}. Please check console for details and try again.`);
        return;
      }
    } else { 
      console.warn('[AddExpense] Missing orgId, write skipped');
      alert('Unable to save expense. Please refresh the page and try again.');
      return;
    }

    // Update local state after successful Firestore write
    setExpenses(prev => {
      const existing = prev.find(e => e.id === newExpense.id);
      if (existing) {
        // Expense already exists (from sync), merge updates
        return prev.map(e => e.id === newExpense.id ? { ...newExpense, ...e } : e);
      }
      // Add new expense and sort by date (newest first), then by createdAt (newest first)
      return [...prev, newExpense].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        // If same date, sort by createdAt (newest first)
        const aCreated = new Date(a.createdAt || a.updatedAt || '').getTime();
        const bCreated = new Date(b.createdAt || b.updatedAt || '').getTime();
        return bCreated - aCreated;
      });
    });
    setCurrentBalance(newBalance);
    
    if (orgId) {
      recordAuditEvent(orgId, {
        action: 'create',
        entity: 'expense',
        actor: { email: currentUserEmail },
        details: { id: newExpense.id, name: newExpense.name, amountPKR: newExpense.amount, amountUSD: newExpense.usdAmount },
        timestamp: getPKRTimestamp(),
      });
    } else { console.warn('[AddExpense] Missing orgId, write skipped'); }
    sendAudit({ action: 'create', entity: 'expense', details: { id: newExpense.id, name: newExpense.name, amount: newExpense.amount } });
    setShowExpenseForm(false);
  };

  const handleEditExpense = (updatedExpense: Expense) => {
    const finalExpense = {
      ...updatedExpense,
      updatedBy: { uid: currentUserId, email: currentUserEmail },
      updatedAt: getPKRTimestamp(),
    };
    setExpenses(prev => prev.map(e => e.id === finalExpense.id ? finalExpense : e));
    if (orgId) {
      dbUpsertExpense(orgId, finalExpense);
      recordAuditEvent(orgId, {
        action: 'update',
        entity: 'expense',
        actor: { email: currentUserEmail },
        details: { id: finalExpense.id, name: finalExpense.name, contactId: finalExpense.contactId },
        timestamp: getPKRTimestamp(),
      });
    }
    setEditingExpense(null);
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
      createdAt: getPKRTimestamp(),
      updatedAt: getPKRTimestamp(),
    };

    setDebits(prev => [...prev, newDebit].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setCurrentBalance(newBalance);
    if (orgId) {
      dbUpsertDebit(orgId, newDebit);
      dbSetBalance(orgId, newBalance);
      recordAuditEvent(orgId, {
        action: 'create', entity: 'debit', actor: { email: currentUserEmail },
        details: { id: newDebit.id, name: newDebit.source, amountPKR: newDebit.amount, amountUSD: newDebit.usdAmount },
        timestamp: getPKRTimestamp(),
      });
    } else { console.warn('[AddDebit] Missing orgId, write skipped'); }
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
      createdAt: getPKRTimestamp(),
      updatedAt: getPKRTimestamp(),
    };

    setLoans(prev => [...prev, newLoan].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setCurrentBalance(newBalance);
    if (orgId) {
      dbUpsertLoan(orgId, newLoan);
      dbSetBalance(orgId, newBalance);
      recordAuditEvent(orgId, {
        action: 'create', entity: 'loan', actor: { email: currentUserEmail },
        details: { id: newLoan.id, name: newLoan.partnerName, amountPKR: newLoan.amount, amountUSD: newLoan.usdAmount },
        timestamp: getPKRTimestamp(),
      });
    } else { console.warn('[AddLoan] Missing orgId, write skipped'); }
    sendAudit({ action: 'create', entity: 'loan', details: { id: newLoan.id, partnerName: newLoan.partnerName, amount: newLoan.amount } });
    setShowLoanForm(false);
  };

  const handleRepayLoan = async (loanId: string, data: LoanRepaymentFormData) => {
    // Convert PKR to USD using the same conversion stored in forms: usdAmount is already provided/derived by form
    const pkrAmount = parseFloat(data.amount || '0');
    let usdAmount = parseFloat(data.usdAmount || '0');
    
    // Validate PKR amount first (primary validation)
    if (isNaN(pkrAmount) || pkrAmount <= 0) {
      alert('Invalid repayment amount. Please enter a valid PKR amount.');
      return;
    }
    
    // If USD amount is 0 or invalid (can happen with very small PKR amounts), recalculate it
    if (usdAmount <= 0 || isNaN(usdAmount)) {
      // Calculate USD from PKR using a standard rate (if form didn't provide valid USD)
      // This handles edge cases where small PKR amounts round to 0 USD
      const estimatedRate = pkrAmount > 0 ? (parseFloat(data.usdAmount || '0') / pkrAmount) : 280;
      if (isNaN(estimatedRate) || estimatedRate <= 0) {
        usdAmount = pkrAmount / 280; // Fallback to default rate
      } else {
        usdAmount = pkrAmount * estimatedRate;
      }
    }
    
    // Ensure minimum USD value for very small PKR amounts
    if (usdAmount < 0.001) {
      usdAmount = 0.001; // Set minimum to allow very small repayments
    }

    const loan = loans.find(l => l.id === loanId);
    if (!loan) {
      alert('Loan not found. Please refresh and try again.');
      return;
    }

    // Check if repayment amount exceeds remaining loan amount
    if (pkrAmount > loan.amount) {
      alert(`Repayment amount (${pkrAmount.toFixed(2)} PKR) exceeds remaining loan amount (${loan.amount.toFixed(2)} PKR).`);
      return;
    }

    const newBalance = currentBalance + usdAmount; // repayments increase USD balance
    const newLoanAmount = Math.max(0, loan.amount - pkrAmount);
    const newLoanUsdAmount = Math.max(0, loan.usdAmount - usdAmount);

    const repayment: LoanRepayment = {
      id: generateId(),
      loanId,
      amount: pkrAmount,
      usdAmount: usdAmount,
      date: data.date,
      description: data.description,
      createdBy: { uid: currentUserId, email: currentUserEmail },
      createdAt: getPKRTimestamp(),
      updatedAt: getPKRTimestamp(),
    };

    const updatedLoan: Loan = {
      ...loan,
      amount: newLoanAmount,
      usdAmount: newLoanUsdAmount,
      currentBalance: newBalance,
      repayments: [...(loan.repayments || []), repayment],
      updatedAt: getPKRTimestamp(),
    };

    // Update local state first
    setLoans(prev => prev.map(l => (l.id === loanId ? updatedLoan : l)));
    setCurrentBalance(newBalance);

    // Save to Firestore
    if (orgId) {
      try {
        // Try atomic append first
        await appendRepayment(orgId, loanId, repayment);
        await dbSetBalance(orgId, newBalance);
        console.log('[RepayLoan] Repayment saved successfully via appendRepayment');
      } catch (error) {
        console.error('[RepayLoan] appendRepayment failed, falling back to dbUpsertLoan:', error);
        // Fallback to full upsert if atomic append fails
        try {
          await dbUpsertLoan(orgId, updatedLoan);
          await dbSetBalance(orgId, newBalance);
          console.log('[RepayLoan] Repayment saved successfully via dbUpsertLoan');
        } catch (fallbackError) {
          console.error('[RepayLoan] dbUpsertLoan also failed:', fallbackError);
          alert('Failed to save repayment to database. Please try again.');
          // Revert local state on error
          setLoans(prev => prev.map(l => (l.id === loanId ? loan : l)));
          setCurrentBalance(currentBalance);
          return;
        }
      }
    } else {
      console.warn('[RepayLoan] Missing orgId');
      alert('Unable to save repayment. Please refresh the page and try again.');
      // Revert local state
      setLoans(prev => prev.map(l => (l.id === loanId ? loan : l)));
      setCurrentBalance(currentBalance);
      return;
    }

    // Record audit
    if (orgId) {
      recordAuditEvent(orgId, {
        action: 'repayment', entity: 'loan', actor: { email: currentUserEmail },
        details: { loanId, name: loan.partnerName, amountPKR: pkrAmount, amountUSD: usdAmount },
        timestamp: getPKRTimestamp(),
      });
    }
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
      createdAt: getPKRTimestamp(),
      updatedAt: getPKRTimestamp(),
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
        updatedAt: getPKRTimestamp(),
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
      if (orgId) { dbDeleteExpense(orgId, id); recordAuditEvent(orgId, { action: 'delete', entity: 'expense', actor: { email: currentUserEmail }, details: { id, name: expenseToDelete?.name, amountPKR: expenseToDelete?.amount, amountUSD: expenseToDelete?.usdAmount }, timestamp: getPKRTimestamp() }); }
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
      if (orgId) { dbDeleteDebit(orgId, id); recordAuditEvent(orgId, { action: 'delete', entity: 'debit', actor: { email: currentUserEmail }, details: { id, name: debitToDelete?.source, amountPKR: debitToDelete?.amount, amountUSD: debitToDelete?.usdAmount }, timestamp: getPKRTimestamp() }); }
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
      if (orgId) { dbDeleteLoan(orgId, id); recordAuditEvent(orgId, { action: 'delete', entity: 'loan', actor: { email: currentUserEmail }, details: { id, name: loanToDelete?.partnerName, amountPKR: loanToDelete?.amount, amountUSD: loanToDelete?.usdAmount }, timestamp: getPKRTimestamp() }); }
      sendAudit({ action: 'delete', entity: 'loan', details: { id } });
    }
  };

  const handleDeleteContact = (id: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      setContacts(prev => prev.filter(contact => contact.id !== id));
      if (orgId) { dbDeleteContact(orgId, id); recordAuditEvent(orgId, { action: 'delete', entity: 'contact', actor: { email: currentUserEmail }, details: { id, name: contacts.find(c=>c.id===id)?.name }, timestamp: getPKRTimestamp() }); }
    sendAudit({ action: 'delete', entity: 'contact', details: { id } });
    }
  };

  const handleUpdateBalance = (newBalance: number) => {
    // Simply update the current balance without recalculating transaction amounts
    // This preserves PKR amounts and only changes the current available balance
    setCurrentBalance(newBalance);
    
    if (orgId) {
      dbSetBalance(orgId, newBalance);
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
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
             {/* Navigation */}
       <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img src="/logo.png" alt="eCom Gliders" className="h-7 w-7 mr-2" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">eCom Gliders</h1>
            </div>
            
                         {/* Desktop navbar */}
             <div className="hidden sm:flex items-center space-x-4">
               <ThemeToggle />
               {currentUserName && (
                 <div className="hidden sm:flex items-center px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm">
                   {currentUserName}
                 </div>
               )}
               <button
                 onClick={() => logout()}
                 className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                 title="Sign out"
               >
                 Sign out
               </button>
              <button
                // Reset button intentionally hidden per requirements
                style={{ display: 'none' }}
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
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Home size={16} className="mr-2" />
                Dashboard
              </button>
              
              <button
                onClick={() => setCurrentView('expenses')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'expenses'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <List size={16} className="mr-2" />
                Expenses
              </button>

              <button
                onClick={() => setCurrentView('credits')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'credits'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <TrendingUp size={16} className="mr-2" />
                Income
              </button>

              <button
                onClick={() => setCurrentView('loans')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'loans'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <UserCheck size={16} className="mr-2" />
                Loans
              </button>

              <button
                onClick={() => setCurrentView('contacts')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'contacts'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Users size={16} className="mr-2" />
                Contacts
              </button>
              <button
                onClick={() => setCurrentView('logs')}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentView === 'logs'
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Logs"
              >
                <Activity size={16} className="mr-2" />
                Logs
              </button>
            </div>

            {/* Mobile menu toggle */}
            <button
              className="sm:hidden inline-flex items-center p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Toggle navigation"
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="px-4 py-3 space-y-2">
            <button onClick={() => { setCurrentView('dashboard'); setMobileMenuOpen(false); }} className={`block w-full text-left px-3 py-2 rounded-lg ${currentView==='dashboard'?'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Dashboard</button>
            <button onClick={() => { setCurrentView('expenses'); setMobileMenuOpen(false); }} className={`block w-full text-left px-3 py-2 rounded-lg ${currentView==='expenses'?'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Expenses</button>
            <button onClick={() => { setCurrentView('credits'); setMobileMenuOpen(false); }} className={`block w-full text-left px-3 py-2 rounded-lg ${currentView==='credits'?'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Income</button>
            <button onClick={() => { setCurrentView('loans'); setMobileMenuOpen(false); }} className={`block w-full text-left px-3 py-2 rounded-lg ${currentView==='loans'?'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Loans</button>
            <button onClick={() => { setCurrentView('contacts'); setMobileMenuOpen(false); }} className={`block w-full text-left px-3 py-2 rounded-lg ${currentView==='contacts'?'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Contacts</button>
            <button onClick={() => { setCurrentView('logs'); setMobileMenuOpen(false); }} className={`block w-full text-left px-3 py-2 rounded-lg ${currentView==='logs'?'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300':'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Logs</button>
            <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Sign out</button>
          </div>
        </div>
      )}

             {/* Main Content */}
       <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 dark:bg-gray-900">
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
            onNavigate={(view) => { console.log('[Nav] setCurrentView', view); setCurrentView(view); }}
            audit={audit}
          />
        ) : currentView === 'expenses' ? (
          <ExpenseList 
            expenses={expenses}
            contacts={contacts}
            debits={debits}
            loans={loans}
            onDelete={handleDeleteExpense}
            onAddExpense={() => openExpenseForm()}
            onEditExpense={(expense) => setEditingExpense(expense)}
          />
        ) : currentView === 'credits' ? (
          <DebitList 
            debits={debits}
            expenses={expenses}
            loans={loans}
            onDelete={handleDeleteDebit}
            onAddDebit={() => openDebitForm()}
          />
        ) : currentView === 'loans' ? (
          <LoanList 
            loans={loans}
            expenses={expenses}
            debits={debits}
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
                updatedAt: getPKRTimestamp(),
              };
              setLoans(prev => prev.map(l => (l.id === loanId ? updatedLoan : l)));
              if (orgId) { dbUpsertLoan(orgId, updatedLoan); dbSetBalance(orgId, newBalance); }
            }}
          />
        ) : currentView === 'logs' ? (
          <LogsPage audit={audit} />
        ) : (
          <ContactsPage 
            contacts={contacts}
            expenses={expenses}
            onAddContact={() => openContactForm()}
            onDeleteContact={handleDeleteContact}
            onEditContact={handleEditContact}
            onNavigateToExpense={() => setCurrentView('expenses')}
          />
        )}
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col space-y-3">
        <button
          onClick={() => openDebitForm()}
          className="bg-success-600 hover:bg-success-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:shadow-xl dark:shadow-gray-900/50"
          title="Add Money"
        >
          <Plus size={24} />
        </button>
        <button
          onClick={() => openExpenseForm()}
          className="bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:shadow-xl dark:shadow-gray-900/50"
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

      {/* Expense Edit Modal */}
      {editingExpense && (
        <ExpenseEditForm
          expense={editingExpense}
          contacts={contacts}
          onSave={handleEditExpense}
          onCancel={() => setEditingExpense(null)}
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

      {repayLoanId && (() => {
        const loan = loans.find(l => l.id === repayLoanId);
        if (!loan) return null;
        
        if (!editingRepayment) {
          return (
            <LoanRepaymentForm
              key={`repay-${repayLoanId}`}
              onSubmit={async (data) => { 
                await handleRepayLoan(repayLoanId, data); 
                closeRepayModal(); 
              }}
              onCancel={closeRepayModal}
              maxPKR={loan.amount}
            />
          );
        }
        
        const repayment = loan.repayments?.find(r => r.id === editingRepayment.repaymentId);
        if (!repayment) return null;
        
        return (
          <LoanRepaymentForm
            key={`edit-repay-${editingRepayment.repaymentId}`}
            onSubmit={(data) => {
              const oldUsd = repayment.usdAmount;
              const newUsd = parseFloat(data.usdAmount || '0');
              const oldPkr = repayment.amount;
              const newPkr = parseFloat(data.amount || '0');
              const deltaUsd = newUsd - oldUsd;
              setCurrentBalance(prev => prev + deltaUsd);
              const updatedRepayments = (loan.repayments || []).map(r => 
                r.id === repayment.id 
                  ? { ...r, amount: newPkr, usdAmount: newUsd, date: data.date, description: data.description, updatedAt: getPKRTimestamp() } 
                  : r
              );
              const usdOutstanding = Math.max(0, (loan.usdAmount + oldUsd) - newUsd);
              const pkrOutstanding = Math.max(0, (loan.amount + oldPkr) - newPkr);
              const updatedLoan: Loan = { 
                ...loan, 
                usdAmount: usdOutstanding, 
                amount: pkrOutstanding, 
                repayments: updatedRepayments, 
                updatedAt: getPKRTimestamp() 
              };
              setLoans(prev => prev.map(l => (l.id === loan.id ? updatedLoan : l)));
              if (orgId) { 
                dbUpsertLoan(orgId, updatedLoan); 
                dbSetBalance(orgId, currentBalance + deltaUsd); 
              }
              closeRepayModal();
            }}
            onCancel={closeRepayModal}
            maxPKR={loan.amount + repayment.amount}
            initialData={{ 
              amount: String(repayment.amount), 
              usdAmount: String(repayment.usdAmount), 
              date: repayment.date, 
              description: repayment.description || '' 
            }}
            title="Edit Repayment"
            submitText="Update Repayment"
          />
        );
      })()}

      {/* Contact Form Modal */}
      {showContactForm && (
        <ContactForm
          onSubmit={editingContact ? handleUpdateContact : handleAddContact}
          onCancel={closeContactForm}
        />
      )}
      </div>
    </ThemeProvider>
  );
};

export default App; 