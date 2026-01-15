import React, { useState } from 'react';
import { X, Save, User, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { Expense, Contact } from '../types';

interface ExpenseEditFormProps {
  expense: Expense;
  contacts: Contact[];
  onSave: (expense: Expense) => void;
  onCancel: () => void;
}

const ExpenseEditForm: React.FC<ExpenseEditFormProps> = ({ expense, contacts, onSave, onCancel }) => {
  const [selectedContactId, setSelectedContactId] = useState<string>(expense.contactId || '');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const selectedContact = contacts.find(c => c.id === selectedContactId);

  const handleSave = () => {
    const updatedExpense: Expense = {
      ...expense,
      accountNumber: selectedContact ? selectedContact.accountNumber : expense.accountNumber,
      contactId: selectedContactId || '', // Empty string to clear
    };
    onSave(updatedExpense);
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContactId(contact.id);
    setShowContactDropdown(false);
  };

  const handleClearContact = () => {
    setSelectedContactId('');
    setShowContactDropdown(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Expense
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Expense Info (Read Only) */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-3">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Expense Name</p>
              <p className="font-semibold text-gray-900 dark:text-white">{expense.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Amount</p>
              <p className="font-semibold text-gray-900 dark:text-white">PKR {expense.amount.toLocaleString()}</p>
            </div>
            {expense.receiptImageUrl && (
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Receipt</p>
                <button
                  type="button"
                  onClick={() => window.open(expense.receiptImageUrl, '_blank')}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <ImageIcon size={16} />
                  View Receipt
                </button>
              </div>
            )}
          </div>

          {/* Contact Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Contact
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowContactDropdown(!showContactDropdown)}
                className="w-full flex items-center justify-between p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <User className="text-gray-400" size={20} />
                  <span className={selectedContact ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                    {selectedContact ? selectedContact.name : 'No contact selected'}
                  </span>
                </div>
                <ChevronDown className={`text-gray-400 transition-transform ${showContactDropdown ? 'rotate-180' : ''}`} size={16} />
              </button>
              
              {showContactDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  <button
                    type="button"
                    onClick={handleClearContact}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 text-red-600 dark:text-red-400 font-medium"
                  >
                    ✕ Remove Contact
                  </button>
                  {contacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => handleContactSelect(contact)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${selectedContactId === contact.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{contact.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{contact.accountNumber}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="btn-primary flex-1 flex items-center justify-center"
            >
              <Save size={16} className="mr-2" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpenseEditForm;
