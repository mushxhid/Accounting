export interface Expense {
  id: string;
  name: string;
  amount: number; // PKR amount
  usdAmount: number; // USD amount
  accountNumber: string;
  contactId?: string; // optional contact reference
  date: string;
  currentBalance: number;
  description?: string;
  receiptImageUrl?: string; // Cloudinary URL for payment screenshot
  receiptImagePublicId?: string; // Cloudinary public ID for deletion
  createdBy?: UserIdentity;
  updatedBy?: UserIdentity;
  createdAt: string;
  updatedAt: string;
}

export interface Debit {
  id: string;
  amount: number; // PKR amount
  usdAmount: number; // USD amount
  source: string;
  date: string;
  currentBalance: number;
  description?: string;
  createdBy?: UserIdentity;
  updatedBy?: UserIdentity;
  createdAt: string;
  updatedAt: string;
}

export interface Loan {
  id: string;
  partnerName: string;
  amount: number; // PKR amount
  usdAmount: number; // USD amount
  date: string;
  currentBalance: number;
  description?: string;
  repayments?: LoanRepayment[]; // list of repayments against this loan
  // Principal amounts at the time the loan was created (for progress/remaining calc)
  principalAmount?: number; // PKR
  principalUSDAmount?: number; // USD
  createdBy?: UserIdentity;
  updatedBy?: UserIdentity;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  accountNumber: string;
  description?: string;
  createdBy?: UserIdentity;
  updatedBy?: UserIdentity;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseFormData {
  name: string;
  amount: string; // PKR amount
  usdAmount: string; // USD amount
  accountNumber: string;
  contactId?: string; // optional contact reference
  date: string;
  description: string;
  receiptImageUrl?: string; // Cloudinary URL for payment screenshot
}

export interface DebitFormData {
  amount: string; // PKR amount
  usdAmount: string; // USD amount
  source: string;
  date: string;
  description: string;
}

export interface LoanFormData {
  partnerName: string;
  amount: string; // PKR amount
  usdAmount: string; // USD amount
  date: string;
  description: string;
}

export interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number; // PKR amount
  usdAmount: number; // USD amount
  date: string;
  description?: string;
  createdBy?: UserIdentity;
  createdAt: string;
  updatedAt: string;
}

export interface LoanRepaymentFormData {
  amount: string; // PKR amount
  usdAmount: string; // USD amount
  date: string;
  description: string;
}

export interface UserIdentity {
  uid: string;
  email?: string;
  name?: string;
}

export interface ContactFormData {
  name: string;
  accountNumber: string;
  description: string;
}

export interface Account {
  id: string;
  name: string;
  accountNumber: string;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalExpenses: number;
  totalBalance: number;
  monthlyExpenses: number;
  recentExpenses: Expense[];
} 