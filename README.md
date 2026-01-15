# Amazon Agency Accounting Software

A modern, beautiful accounting application designed specifically for Amazon agency expense tracking. Built with React, TypeScript, and Tailwind CSS.

## Features

### 📊 Dashboard
- **Overview Statistics**: Total expenses, current balance, and monthly spending
- **Recent Expenses**: Quick view of latest transactions
- **Beautiful Cards**: Clean, modern UI with intuitive icons.

### 💰 Expense Management
- **Add Expenses**: Complete form with all required fields
- **Edit Expenses**: Modify existing entries easily
- **Delete Expenses**: Remove entries with confirmation
- **Search & Filter**: Find expenses quickly
- **Sort Options**: Sort by date, amount, or name

### 📱 Modern UI/UX
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Dark/Light Theme**: Clean, professional appearance
- **Smooth Animations**: Pleasant user experience
- **Intuitive Navigation**: Easy switching between views

### 🔒 Data Persistence
- **Local Storage**: Data persists between sessions
- **Firebase Ready**: Prepared for cloud storage integration

## Required Fields

When adding an expense, you'll need to provide:

1. **Expense Name** - Description of the expense
2. **Amount Paid** - The cost in USD
3. **Account Number** - Bank account or payment method
4. **Date** - When the expense occurred
5. **Current Balance** - Account balance after payment

## Getting Started

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**
   ```bash
   cd amazon-agency-accounting
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Build for Production

```bash
npm run build
```

## Firebase Integration (Optional)

To enable cloud storage, update the Firebase configuration in `src/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

## Technology Stack

- **React 18** - Modern UI library
- **TypeScript** - Type safety and better development experience
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icons
- **Vite** - Fast build tool
- **date-fns** - Date formatting utilities

## Project Structure

```
src/
├── components/          # React components
│   ├── Dashboard.tsx   # Main dashboard view
│   ├── ExpenseForm.tsx # Add/edit expense form
│   ├── ExpenseCard.tsx # Individual expense display
│   └── ExpenseList.tsx # List view with search/filter
├── types/              # TypeScript type definitions
├── utils/              # Helper functions
├── App.tsx            # Main application component
├── main.tsx           # Application entry point
└── index.css          # Global styles
```

## Usage

1. **Dashboard View**: Overview of your financial status
2. **Expenses View**: Complete list with search and filtering
3. **Add Expense**: Click the floating "+" button or "Add Expense" button
4. **Edit/Delete**: Use the action buttons on each expense card

## Features in Detail

### Dashboard
- Real-time statistics
- Monthly expense tracking
- Recent transaction overview
- Quick action buttons

### Expense Management
- Form validation
- Date picker
- Currency formatting
- Account tracking
- Balance monitoring

### Search & Filter
- Search by expense name or account number
- Sort by date, amount, or name
- Ascending/descending order
- Real-time filtering

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For questions or issues, please open an issue on the repository. 
