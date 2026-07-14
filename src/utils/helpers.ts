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
  // Prefer a collision-resistant UUID; fall back for older environments.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
};

// PKR Timezone utilities
export const getPKRTimestamp = (): string => {
  // Store the true absolute instant as a UTC ISO string. The display helpers
  // (formatPKRDateTime/Date/Time) apply the Asia/Karachi timezone when rendering,
  // so we must NOT pre-shift here — doing so double-shifted the displayed time.
  return new Date().toISOString();
};

export const getPKRDateString = (): string => {
  // Current calendar date in Pakistan timezone as YYYY-MM-DD.
  // en-CA formats as YYYY-MM-DD; timeZone ensures the correct PK day near midnight.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
  
  // Neutralize CSV/formula injection: a leading =, +, -, @ (or tab/CR) can be
  // interpreted as a formula by Excel/Sheets. Prefix such values with a quote.
  const sanitizeForCSV = (value: any): any => {
    if (typeof value !== 'string') return value;
    // Only escape genuine formula-like strings, not plain numbers (e.g. "-1234.00"
    // negative balances must stay numeric in the export).
    if (/^[=+\-@\t\r]/.test(value) && Number.isNaN(Number(value))) return `'${value}`;
    return value;
  };

  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => {
        const value = sanitizeForCSV(row[header]);
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