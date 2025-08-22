import React, { useState } from 'react';
import { Plus, Trash2, User, CreditCard, FileText, Edit, Search, X, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { Contact, Expense } from '../types';

import { formatPKR, formatUSD } from '../utils/currencyConverter';
import { formatPKRDate } from '../utils/helpers';

interface ContactsPageProps {
  contacts: Contact[];
  expenses: Expense[];
  onAddContact: () => void;
  onDeleteContact: (id: string) => void;
  onEditContact: (contact: Contact) => void;
}

const ContactsPage: React.FC<ContactsPageProps> = ({ 
  contacts, 
  expenses,
  onAddContact, 
  onDeleteContact,
  onEditContact 
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
    const contactExpenses = expenses.filter(expense => expense.accountNumber === contact.accountNumber);
    // Note: Debits (income) don't have accountNumber, so we'll show all income
    // You can modify this logic if you want to associate income with specific contacts
    
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

      {/* Contacts List */}
      <div className="card">
        {sortedContacts.length === 0 ? (
          <div className="text-center py-12">
            <User className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm 
                ? 'Try adjusting your search terms.'
                : 'Add your first contact to get started with quick expense entry.'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={onAddContact}
                className="btn-primary"
              >
                Add Your First Contact
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
                      onClick={() => handleSort('name')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <User size={16} />
                      <span>Name</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('accountNumber')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <CreditCard size={16} />
                      <span>Account Number</span>
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <FileText size={16} className="mr-1" />
                    Description
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    <button
                      onClick={() => handleSort('createdAt')}
                      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
                    >
                      <span>Added</span>
                    </button>
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleContactClick(contact)}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                          <User className="text-primary-600" size={16} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{contact.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-mono text-sm text-gray-700">{contact.accountNumber}</p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-gray-600 text-sm">
                        {contact.description || '—'}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-500">
                        {formatPKRDate(contact.createdAt)}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => onEditContact(contact)}
                          className="text-primary-600 hover:text-primary-700 p-2 rounded-lg hover:bg-primary-50 transition-colors"
                          title="Edit contact"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => onDeleteContact(contact.id)}
                          className="text-danger-600 hover:text-danger-700 p-2 rounded-lg hover:bg-danger-50 transition-colors"
                          title="Delete contact"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contact Detail Modal */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <User className="text-primary-600" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedContact.name}</h2>
                  <p className="text-gray-600">{selectedContact.accountNumber}</p>
                  {selectedContact.description && (
                    <p className="text-sm text-gray-500 mt-1">{selectedContact.description}</p>
                  )}
                </div>
              </div>
              <button
                onClick={closeContactDetail}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Financial Summary */}
              {(() => {
                const financialData = getContactFinancialData(selectedContact);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="card">
                      <div className="flex items-center">
                        <div className="p-3 bg-danger-100 rounded-lg">
                          <DollarSign className="text-danger-600" size={24} />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatUSD(financialData.totalExpenses)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="flex items-center">
                        <div className="p-3 bg-success-100 rounded-lg">
                          <TrendingUp className="text-success-600" size={24} />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Income</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatUSD(financialData.totalIncome)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="flex items-center">
                        <div className={`p-3 rounded-lg ${financialData.netAmount >= 0 ? 'bg-success-100' : 'bg-danger-100'}`}>
                          <DollarSign className={financialData.netAmount >= 0 ? 'text-success-600' : 'text-danger-600'} size={24} />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Net Amount</p>
                          <p className={`text-2xl font-bold ${financialData.netAmount >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                            {formatUSD(Math.abs(financialData.netAmount))}
                          </p>
                          <p className="text-sm text-gray-500">
                            {financialData.netAmount >= 0 ? 'Net Income' : 'Net Expense'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Expenses List */}
              {(() => {
                const financialData = getContactFinancialData(selectedContact);
                return (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                        <DollarSign className="text-danger-600 mr-2" size={20} />
                        Expenses ({financialData.expenses.length})
                      </h3>
                      {financialData.expenses.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <DollarSign className="mx-auto text-gray-400 mb-2" size={32} />
                          <p className="text-gray-600">No expenses recorded for this contact</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {financialData.expenses.map((expense) => (
                            <div key={expense.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-4">
                                <div className="p-2 bg-danger-100 rounded-lg">
                                  <DollarSign className="text-danger-600" size={16} />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{expense.name}</p>
                                  <p className="text-sm text-gray-500">{expense.description || '—'}</p>
                                  <p className="text-xs text-gray-400 flex items-center mt-1">
                                    <Calendar size={12} className="mr-1" />
                                    {formatPKRDate(expense.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-danger-600">
                                  -{formatUSD(expense.usdAmount)}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {formatPKR(expense.amount)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                                         {/* Income List */}
                     <div>
                       <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                         <TrendingUp className="text-success-600 mr-2" size={20} />
                         Income
                       </h3>
                       <div className="text-center py-8 bg-gray-50 rounded-lg">
                         <TrendingUp className="mx-auto text-gray-400 mb-2" size={32} />
                         <p className="text-gray-600">Income is not currently associated with contacts</p>
                         <p className="text-sm text-gray-500 mt-1">All income is shown in the Income section</p>
                       </div>
                     </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsPage; 