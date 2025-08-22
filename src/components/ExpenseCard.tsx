import React from 'react';
import { Calendar, DollarSign, CreditCard, TrendingDown, Edit, Trash2 } from 'lucide-react';
import { Expense } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';

interface ExpenseCardProps {
  expense: Expense;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, onEdit, onDelete }) => {
  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 break-words">
            {expense.name}
          </h3>
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <Calendar size={14} className="mr-1" />
            {formatDate(expense.date)}
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(expense)}
            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(expense.id)}
            className="p-2 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-600">
            <DollarSign size={16} className="mr-2 text-danger-500" />
            Amount Paid
          </div>
          <span className="font-semibold text-danger-600">
            {formatCurrency(expense.amount)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-600">
            <CreditCard size={16} className="mr-2 text-gray-500" />
            Account
          </div>
          <span className="font-medium text-gray-900">
            {expense.accountNumber}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center text-sm text-gray-600">
            <TrendingDown size={16} className="mr-2 text-success-500" />
            Balance After
          </div>
          <span className="font-semibold text-success-600">
            {formatCurrency(expense.currentBalance)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ExpenseCard; 