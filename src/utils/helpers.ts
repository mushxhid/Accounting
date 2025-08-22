import { format, parseISO } from 'date-fns';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  const date = parseISO(dateString);
  return format(date, 'MMM dd, yyyy');
};

export const formatDateForInput = (dateString: string): string => {
  const date = parseISO(dateString);
  return format(date, 'yyyy-MM-dd');
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// PKR Timezone utilities
export const getPKRTimestamp = (): string => {
  // Create a date in PKR timezone (Asia/Karachi)
  const now = new Date();
  const pkrTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Karachi"}));
  return pkrTime.toISOString();
};

export const formatPKRDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Karachi',
    hour12: true
  });
};

export const formatPKRDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Karachi'
  });
};

export const formatPKRTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Karachi',
    hour12: true
  });
};

export const calculateTotalExpenses = (expenses: any[]): number => {
  return expenses.reduce((total, expense) => total + expense.usdAmount, 0);
};

export const getCurrentBalance = (expenses: any[], currentBalance?: number): number => {
  if (currentBalance !== undefined) {
    return currentBalance;
  }
  
  if (expenses.length === 0) {
    // Return a default starting balance (you can modify this value)
    return 10000; // $10,000 starting balance
  }
  return expenses[expenses.length - 1].currentBalance;
}; 

export const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from the first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values that need quotes (contain commas, quotes, or newlines)
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}; 