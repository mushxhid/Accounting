import React, { useState } from 'react';
import { X } from 'lucide-react';
import { LoanRepaymentFormData } from '../types';
import { getPKRDateString } from '../utils/helpers';

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
    date: initialData?.date ?? getPKRDateString(), // Use Pakistan timezone date
    description: initialData?.description ?? ''
  });

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-900 border-2 border-gray-400 dark:border-gray-600 shadow-lg w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header - Excel style */}
        <div className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600 px-3 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-red-500 border border-gray-600"></div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
              {title ?? 'Record Loan Repayment'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 px-2 py-1 border border-gray-400 dark:border-gray-500"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content - Excel cell style */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-900 space-y-4">
          <div className="border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Arial, sans-serif' }}>Amount Paid (PKR)</label>
            </div>
            <div className="relative">
              <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-600 dark:text-gray-400 font-medium" style={{ fontFamily: 'Arial, sans-serif' }}>PKR</span>
              <input 
                type="number" 
                step="0.01" 
                min="0" 
                max={maxPKR ?? undefined} 
                value={formData.amount} 
                onChange={(e) => handleInputChange('amount', e.target.value)} 
                className="w-full pl-12 pr-2 py-1.5 text-sm border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400"
                style={{ fontFamily: 'Arial, sans-serif' }}
                placeholder="0.00" 
              />
            </div>
            {typeof maxPKR === 'number' && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>
                Remaining after: {(() => {
                  const amt = parseFloat(formData.amount || '0');
                  const remain = Math.max(0, (maxPKR || 0) - amt);
                  return `Rs ${remain.toLocaleString('en-PK')}`;
                })()}
              </div>
            )}
          </div>

          <div className="border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 p-3">
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5" style={{ fontFamily: 'Arial, sans-serif' }}>Date</label>
            <input 
              type="date" 
              value={formData.date} 
              onChange={(e) => handleInputChange('date', e.target.value)} 
              className="w-full px-2 py-1.5 text-sm border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-400"
              style={{ fontFamily: 'Arial, sans-serif' }}
            />
          </div>

          <div className="border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 p-3">
            <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5" style={{ fontFamily: 'Arial, sans-serif' }}>Description (Optional)</label>
            <textarea 
              value={formData.description} 
              onChange={(e) => handleInputChange('description', e.target.value)} 
              className="w-full px-2 py-1.5 text-sm border-2 border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-gray-400" 
              rows={3} 
              placeholder="Notes about this repayment..."
              style={{ fontFamily: 'Arial, sans-serif' }}
            />
          </div>

          {/* Footer - Excel style */}
          <div className="bg-gray-200 dark:bg-gray-700 border-t-2 border-gray-400 dark:border-gray-600 px-3 py-2 flex justify-end gap-2 flex-shrink-0">
            <button 
              type="button" 
              onClick={onCancel} 
              className="px-4 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-500 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {submitText ?? 'Save Repayment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoanRepaymentForm;


