import React, { useState, useEffect } from 'react';
import { X, UserCheck, RefreshCw } from 'lucide-react';
import { LoanFormData } from '../types';
import { fetchPKRtoUSDRate, convertPKRtoUSD, formatUSD, formatExchangeRate } from '../utils/currencyConverter';

interface LoanFormProps {
  onSubmit: (formData: LoanFormData) => void;
  onCancel: () => void;
  initialData?: Partial<LoanFormData>;
  title?: string;
  submitText?: string;
}

const LoanForm: React.FC<LoanFormProps> = ({ onSubmit, onCancel, initialData, title, submitText }) => {
  const [formData, setFormData] = useState<LoanFormData>({
    partnerName: initialData?.partnerName ?? '',
    amount: initialData?.amount ?? '',
    usdAmount: initialData?.usdAmount ?? '',
    date: initialData?.date ?? new Date().toISOString().split('T')[0],
    description: initialData?.description ?? ''
  });

  const [exchangeRate, setExchangeRate] = useState<number>(280); // Default fallback rate
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.partnerName.trim()) {
      alert('Please enter partner name');
      return;
    }
    
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    if (!formData.date) {
      alert('Please select a date');
      return;
    }

    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <UserCheck size={24} className="text-primary-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">{title ?? 'Add Partner Loan'}</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="partnerName" className="block text-sm font-medium text-gray-700 mb-1">
              Partner Name *
            </label>
            <input
              type="text"
              id="partnerName"
              name="partnerName"
              value={formData.partnerName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter partner name"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Loan Amount (PKR) *
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
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
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
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Optional description for the loan"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              {submitText ?? 'Add Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoanForm;
