import React, { useState, useEffect } from 'react';
import { Plus, X, Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { DebitFormData } from '../types';
import { fetchPKRtoUSDRate, convertPKRtoUSD, formatUSD, formatExchangeRate } from '../utils/currencyConverter';

interface DebitFormProps {
  onSubmit: (data: DebitFormData) => void;
  onCancel: () => void;
}

const DebitForm: React.FC<DebitFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<DebitFormData>({
    amount: '',
    usdAmount: '',
    source: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  });

  const [exchangeRate, setExchangeRate] = useState<number>(280); // Default fallback rate
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<string>('');

  const [errors, setErrors] = useState<Partial<DebitFormData>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<DebitFormData> = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Valid amount is required';
    }

    if (!formData.source.trim()) {
      newErrors.source = 'Payment source is required';
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

  const handleInputChange = (field: keyof DebitFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Add Money to Balance
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Amount to Add (PKR)
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

          {/* Payment Source */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Source
            </label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={formData.source}
                onChange={(e) => handleInputChange('source', e.target.value)}
                className={`input-field pl-10 ${errors.source ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="e.g., Bank Transfer, PayPal, Cash"
              />
            </div>
            {errors.source && (
              <p className="mt-1 text-sm text-danger-600">{errors.source}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date of Payment
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

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="input-field resize-none"
              rows={3}
              placeholder="Add any additional notes about this payment..."
            />
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
              Add Money
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DebitForm; 