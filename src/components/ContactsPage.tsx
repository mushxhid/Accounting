import React, { useState } from 'react';
import { Plus, Trash2, User, Edit, Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Contact, Expense } from '../types';

import { formatPKR, formatUSD } from '../utils/currencyConverter';
import { formatPKRDate } from '../utils/helpers';

interface ContactsPageProps {
  contacts: Contact[];
  expenses: Expense[];
  onAddContact: () => void;
  onDeleteContact: (id: string) => void;
  onEditContact: (contact: Contact) => void;
  onNavigateToExpense?: (expenseId?: string) => void;
}

const ContactsPage: React.FC<ContactsPageProps> = ({ 
  contacts, 
  expenses,
  onAddContact, 
  onDeleteContact,
  onEditContact,
  onNavigateToExpense
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'accountNumber' | 'createdAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Filter contacts by search term
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contact.description && contact.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Sort contacts
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'accountNumber':
        comparison = a.accountNumber.localeCompare(b.accountNumber);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: 'name' | 'accountNumber' | 'createdAt') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Get contact's financial data
  const getContactFinancialData = (contact: Contact) => {
    // Only filter by contactId - no fallback to avoid wrong matches
    const contactExpenses = expenses.filter(expense => 
      expense.contactId && expense.contactId !== '' && expense.contactId === contact.id
    );
    
    return {
      expenses: contactExpenses,
      debits: [], // No debits associated with contacts for now
      totalExpenses: contactExpenses.reduce((sum, exp) => sum + exp.usdAmount, 0),
      totalIncome: 0, // No income associated with contacts
      netAmount: -contactExpenses.reduce((sum, exp) => sum + exp.usdAmount, 0) // Only expenses for now
    };
  };

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const closeContactDetail = () => {
    setSelectedContact(null);
  };

  const SortIcon = ({ field }: { field: 'name' | 'accountNumber' | 'createdAt' }) => {
    if (sortBy !== field) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600 mt-1">Manage people you frequently pay</p>
        </div>
        <button
          onClick={onAddContact}
          className="btn-primary flex items-center"
        >
          <Plus size={20} className="mr-2" />
          Add Contact
        </button>
      </div>

      {/* Search and Sort */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as ['name' | 'accountNumber' | 'createdAt', 'asc' | 'desc'];
                setSortBy(field);
                setSortOrder(order);
              }}
              className="input-field"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="accountNumber-asc">Account (A-Z)</option>
              <option value="accountNumber-desc">Account (Z-A)</option>
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contacts List - Excel Style */}
      {sortedContacts.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
          <User className="mx-auto text-gray-400 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No contacts found' : 'No contacts yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm 
              ? 'Try adjusting your search terms.'
              : 'Add your first contact to get started with quick expense entry.'
            }
          </p>
          {!searchTerm && (
            <button onClick={onAddContact} className="btn-primary">
              Add Your First Contact
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-400 dark:border-gray-500">
          <table className="w-full border-collapse bg-white dark:bg-gray-800" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700">
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 w-8">#</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('name')}>
                  <div className="flex items-center">Name<SortIcon field="name" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('accountNumber')}>
                  <div className="flex items-center">Account Number<SortIcon field="accountNumber" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Description</th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => handleSort('createdAt')}>
                  <div className="flex items-center">Added<SortIcon field="createdAt" /></div>
                </th>
                <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-center text-xs font-bold text-gray-800 dark:text-gray-200 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedContacts.map((contact, index) => (
                <tr
                  key={contact.id}
                  className={`cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}`}
                  onClick={() => handleContactClick(contact)}
                >
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-center">{index + 1}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white font-medium">{contact.name}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 font-mono">{contact.accountNumber}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={contact.description || ''}>{contact.description || '—'}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatPKRDate(contact.createdAt)}</td>
                  <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); onEditContact(contact); }} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1" title="Edit">
                        <Edit size={14} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onDeleteContact(contact.id); }} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-200 dark:bg-gray-700 font-bold">
                <td colSpan={6} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-gray-800 dark:text-gray-200 text-center">
                  Total: {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Contact Detail Modal - Basic Excel Style */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50" onClick={closeContactDetail}>
          <div className="bg-white dark:bg-gray-900 border-2 border-gray-400 dark:border-gray-600 shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header - Excel style */}
            <div className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600 px-3 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 border border-gray-600"></div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
                    {selectedContact.name}
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{selectedContact.accountNumber}</p>
                  {selectedContact.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedContact.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={closeContactDetail}
                className="text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 py-1 border border-gray-400 dark:border-gray-500"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content - Excel cell style */}
            <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-900">
              {(() => {
                const financialData = getContactFinancialData(selectedContact);
                
                if (financialData.expenses.length === 0) {
                  return (
                    <div className="text-center py-8 border border-gray-400 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                      <p className="text-sm text-gray-700 dark:text-gray-300">No expenses recorded for this contact</p>
                    </div>
                  );
                }

                return (
                  <div className="border border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-800">
                    <table className="w-full border-collapse" style={{ minWidth: '600px' }}>
                      <thead>
                        <tr className="bg-gray-200 dark:bg-gray-700">
                          <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200 w-8">#</th>
                          <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Date</th>
                          <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Expense Name</th>
                          <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-left text-xs font-bold text-gray-800 dark:text-gray-200">Description</th>
                          <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Amount (PKR)</th>
                          <th className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-right text-xs font-bold text-gray-800 dark:text-gray-200">Amount (USD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financialData.expenses.map((expense, idx) => (
                          <tr
                            key={expense.id}
                            className={`cursor-pointer ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'} hover:bg-blue-50 dark:hover:bg-blue-900/20`}
                            onClick={() => {
                              if (onNavigateToExpense) {
                                onNavigateToExpense();
                                closeContactDetail();
                              }
                            }}
                            title="Click to view in Expenses page"
                          >
                            <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 text-center">{idx + 1}</td>
                            <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white whitespace-nowrap">{formatPKRDate(expense.date)}</td>
                            <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-900 dark:text-white font-medium">{expense.name}</td>
                            <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={expense.description || ''}>{expense.description || '—'}</td>
                            <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 text-right font-medium">-{formatPKR(expense.amount)}</td>
                            <td className="border border-gray-400 dark:border-gray-500 px-2 py-1.5 text-xs text-red-600 dark:text-red-400 text-right">-{formatUSD(expense.usdAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-200 dark:bg-gray-700 font-bold">
                          <td colSpan={4} className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-gray-800 dark:text-gray-200 text-right">
                            Total ({financialData.expenses.length} expenses):
                          </td>
                          <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-red-600 dark:text-red-400 text-right font-bold">
                            -{formatPKR(financialData.expenses.reduce((sum, exp) => sum + exp.amount, 0))}
                          </td>
                          <td className="border border-gray-400 dark:border-gray-500 px-2 py-2 text-xs text-red-600 dark:text-red-400 text-right font-bold">
                            -{formatUSD(financialData.totalExpenses)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </div>
            
            {/* Footer - Excel style */}
            <div className="bg-gray-200 dark:bg-gray-700 border-t-2 border-gray-400 dark:border-gray-600 px-3 py-2 flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={closeContactDetail}
                className="px-4 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsPage; 