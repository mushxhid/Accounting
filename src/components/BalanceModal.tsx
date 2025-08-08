import React, { useState } from 'react';
import { X, DollarSign, Plus } from 'lucide-react';

interface BalanceModalProps {
  currentBalance: number;
  onSubmit: (newBalance: number) => void;
  onCancel: () => void;
}

const BalanceModal: React.FC<BalanceModalProps> = ({ currentBalance, onSubmit, onCancel }) => {
  const [balance, setBalance] = useState(currentBalance.toString());
  const [errors, setErrors] = useState<string>('');

  const validateForm = (): boolean => {
    const amount = parseFloat(balance);
    if (isNaN(amount) || amount < 0) {
      setErrors('Please enter a valid positive amount');
      return false;
    }
    setErrors('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(parseFloat(balance));
    }
  };

  const handleInputChange = (value: string) => {
    setBalance(value);
    if (errors) setErrors('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Update Balance
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Balance
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="number"
                step="0.01"
                min="0"
                value={balance}
                onChange={(e) => handleInputChange(e.target.value)}
                className={`input-field pl-10 ${errors ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500' : ''}`}
                placeholder="0.00"
              />
            </div>
            {errors && (
              <p className="mt-1 text-sm text-danger-600">{errors}</p>
            )}
            <p className="mt-2 text-sm text-gray-600">
              This will set your current available balance. Future expenses will be deducted from this amount.
            </p>
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
              Update Balance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BalanceModal; 