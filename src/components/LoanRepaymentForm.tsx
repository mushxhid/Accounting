import React, { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { LoanRepaymentFormData } from '../types';
import { fetchPKRtoUSDRate, convertPKRtoUSD, formatUSD, formatExchangeRate } from '../utils/currencyConverter';

interface LoanRepaymentFormProps {
  onSubmit: (data: LoanRepaymentFormData) => void;
  onCancel: () => void;
  maxPKR?: number; // prevent overpayment
  initialData?: Partial<LoanRepaymentFormData>;
  title?: string;
  submitText?: string;
}

const LoanRepaymentForm: React.FC<LoanRepaymentFormProps> = ({ onSubmit, onCancel, maxPKR, initialData, title, submitText }) => {
  const [formData, setFormData] = useState<LoanRepaymentFormData>({
    amount: initialData?.amount ?? '',
    usdAmount: initialData?.usdAmount ?? '',
    date: initialData?.date ?? new Date().toISOString().split('T')[0],
    description: initialData?.description ?? ''
  });

  const [exchangeRate, setExchangeRate] = useState<number>(280);
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<string>('');

  const handleInputChange = (field: keyof LoanRepaymentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) return;
    if (maxPKR && parseFloat(formData.amount) > maxPKR) {
      alert(`Amount exceeds remaining: Rs ${maxPKR.toLocaleString('en-PK')}`);
      return;
    }
    onSubmit(formData);
  };

  useEffect(() => { fetchExchangeRate(); }, []);

  const fetchExchangeRate = async () => {
    setIsLoadingRate(true);
    try {
      const rate = await fetchPKRtoUSDRate();
      setExchangeRate(rate);
      setLastRateUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('Failed to fetch exchange rate', e);
    } finally {
      setIsLoadingRate(false);
    }
  };

  useEffect(() => {
    if (formData.amount && !isNaN(parseFloat(formData.amount))) {
      const pkr = parseFloat(formData.amount);
      const usd = convertPKRtoUSD(pkr, exchangeRate);
      setFormData(prev => ({ ...prev, usdAmount: usd.toFixed(2) }));
    } else {
      setFormData(prev => ({ ...prev, usdAmount: '' }));
    }
  }, [formData.amount, exchangeRate]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title ?? 'Record Loan Repayment'}</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Amount Paid (PKR)</label>
              <div className="flex items-center space-x-2">
                <button type="button" onClick={fetchExchangeRate} disabled={isLoadingRate} className="flex items-center text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50">
                  <RefreshCw size={12} className={`mr-1 ${isLoadingRate ? 'animate-spin' : ''}`} />
                  {isLoadingRate ? 'Updating...' : 'Refresh Rate'}
                </button>
                <span className="text-xs text-gray-500">Rate: {formatExchangeRate(exchangeRate)} = $1.00</span>
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm font-medium">PKR</span>
              <input type="number" step="0.01" min="0" max={maxPKR ?? undefined} value={formData.amount} onChange={(e) => handleInputChange('amount', e.target.value)} className="input-field pl-12" placeholder="0.00" />
            </div>
            {typeof maxPKR === 'number' && (
              <div className="text-xs text-gray-500 mt-1">Remaining after: {(() => {
                const amt = parseFloat(formData.amount || '0');
                const remain = Math.max(0, (maxPKR || 0) - amt);
                return `Rs ${remain.toLocaleString('en-PK')}`;
              })()}</div>
            )}
            {formData.usdAmount && (
              <div className="mt-2 p-2 bg-gray-50 rounded-md">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">USD Equivalent:</span>
                  <span className="font-medium text-gray-900">{formatUSD(parseFloat(formData.usdAmount))}</span>
                </div>
                {lastRateUpdate && (
                  <div className="text-xs text-gray-500 mt-1">Rate updated: {lastRateUpdate}</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} className="input-field resize-none" rows={3} placeholder="Notes about this repayment..." />
          </div>

          <div className="flex space-x-3 pt-4">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">{submitText ?? 'Save Repayment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoanRepaymentForm;


