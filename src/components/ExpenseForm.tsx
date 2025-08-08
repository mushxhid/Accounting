import React, { useState, useEffect } from 'react';
import { Plus, X, Calendar, CreditCard, User, ChevronDown, FileText, RefreshCw } from 'lucide-react';
import { ExpenseFormData, Contact } from '../types';
import { fetchPKRtoUSDRate, convertPKRtoUSD, formatUSD, formatExchangeRate } from '../utils/currencyConverter';

interface ExpenseFormProps {
  onSubmit: (data: ExpenseFormData) => void;
  onCancel: () => void;
  contacts: Contact[];
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSubmit, onCancel, contacts }) => {
  const [formData, setFormData] = useState<ExpenseFormData>({
    name: '',
    amount: '',
    usdAmount: '',
    accountNumber: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [exchangeRate, setExchangeRate] = useState<number>(280); // Default fallback rate
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<string>('');

  const [errors, setErrors] = useState<Partial<ExpenseFormData>>({});
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Partial<ExpenseFormData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Expense name is required';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
    }

    if (!formData.accountNumber.trim()) {
      newErrors.accountNumber = 'Account number is required';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field: keyof ExpenseFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setFormData(prev => ({
      ...prev,
      accountNumber: contact.accountNumber
      // Removed automatic name filling - let user type their own expense name
    }));
    setSelectedContact(contact.id);
    setShowContactDropdown(false);
  };

  const handleManualInput = () => {
    setSelectedContact('');
    setFormData(prev => ({
      ...prev,
      name: '',
      accountNumber: ''
    }));
    setShowContactDropdown(false);
    // Focus on the name field after clearing
    setTimeout(() => {
      const nameInput = document.querySelector('input[name="expense-name"]') as HTMLInputElement;
      if (nameInput) {
        nameInput.focus();
      }
    }, 100);
  };

  const selectedContactData = contacts.find(c => c.id === selectedContact);

  // Fetch exchange rate on component mount
  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const fetchExchangeRate = async () => {
    setIsLoadingRate(true);
    try {
      const rate = await fetchPKRtoUSDRate();
      setExchangeRate(rate);
      setLastRateUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
    } finally {
      setIsLoadingRate(false);
    }
  };

  // Auto-convert PKR to USD when amount changes
  useEffect(() => {
    if (formData.amount && !isNaN(parseFloat(formData.amount))) {
      const pkrAmount = parseFloat(formData.amount);
      const usdAmount = convertPKRtoUSD(pkrAmount, exchangeRate);
      setFormData(prev => ({
        ...prev,
        usdAmount: usdAmount.toFixed(2)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        usdAmount: ''
      }));
    }
  }, [formData.amount, exchangeRate]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Add New Expense
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Contact Selection */}
          {contacts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Contact (Optional)
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowContactDropdown(!showContactDropdown)}
                  className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <User className="text-gray-400" size={20} />
                    <span className={selectedContactData ? 'text-gray-900' : 'text-gray-500'}>
                      {selectedContactData ? selectedContactData.name : 'Choose a contact or enter manually'}
                    </span>
                  </div>
                  <ChevronDown className={`text-gray-400 transition-transform ${showContactDropdown ? 'rotate-180' : ''}`} size={16} />
                </button>
                
                {showContactDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <button
                      type="button"
                      onClick={handleManualInput}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 text-primary-600 font-medium"
                    >
                      + Enter manually
                    </button>
                    {contacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => handleContactSelect(contact)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">{contact.name}</div>
                        <div className="text-sm text-gray-500">{contact.accountNumber}</div>
                        {contact.description && (
                          <div className="text-xs text-gray-400">{contact.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Expense Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expense Name
            </label>
            <div className="relative">
              <input
                type="text"
                name="expense-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`input-field ${errors.name ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="e.g., Office Supplies, Marketing"
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-danger-600">{errors.name}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Amount (PKR)
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={fetchExchangeRate}
                  disabled={isLoadingRate}
                  className="flex items-center text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50"
                  title="Refresh exchange rate"
                >
                  <RefreshCw size={12} className={`mr-1 ${isLoadingRate ? 'animate-spin' : ''}`} />
                  {isLoadingRate ? 'Updating...' : 'Refresh Rate'}
                </button>
                <span className="text-xs text-gray-500">
                  Rate: {formatExchangeRate(exchangeRate)} = $1.00
                </span>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-medium">PKR</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                className={`input-field pl-12 ${errors.amount ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="0.00"
              />
            </div>
            {formData.usdAmount && (
              <div className="mt-2 p-2 bg-gray-50 rounded-md">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">USD Equivalent:</span>
                  <span className="font-medium text-gray-900">{formatUSD(parseFloat(formData.usdAmount))}</span>
                </div>
                {lastRateUpdate && (
                  <div className="text-xs text-gray-500 mt-1">
                    Rate updated: {lastRateUpdate}
                  </div>
                )}
              </div>
            )}
            {errors.amount && (
              <p className="mt-1 text-sm text-danger-600">{errors.amount}</p>
            )}
          </div>

          {/* Account Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account Number
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                className={`input-field pl-10 ${errors.accountNumber ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="e.g., 1234-5678-9012-3456"
              />
            </div>
            {errors.accountNumber && (
              <p className="mt-1 text-sm text-danger-600">{errors.accountNumber}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-gray-400" size={20} />
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="input-field pl-10 resize-none"
                rows={3}
                placeholder="e.g., Monthly office supplies, Amazon PPC campaign, Freelance work"
              />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className={`input-field pl-10 ${errors.date ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
              />
            </div>
            {errors.date && (
              <p className="mt-1 text-sm text-danger-600">{errors.date}</p>
            )}
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
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center"
            >
              <Plus size={16} className="mr-2" />
              Add Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseForm; 