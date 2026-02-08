
import { Transaction, SubscriptionPlan } from './types';

export const INCOME_CATEGORIES = [
  'Sales Revenue',
  'Service Fees',
  'Interest Income',
  'Investments',
  'Grants',
  'Other Income'
];

export const EXPENSE_CATEGORIES = [
  'Payroll',
  'Rent',
  'Utilities',
  'Marketing',
  'Software/Subscriptions',
  'Supplies',
  'Taxes',
  'Travel',
  'Insurance',
  'Other Expenses'
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'standard',
    name: 'Standard Tier',
    price: 12,
    features: [
      'Core Ledger Access',
      'Basic P&L Statements',
      'Up to 500 Transactions',
      'Single User Access',
      'Email Support'
    ]
  },
  {
    id: 'strategic',
    name: 'Strategic Tier',
    price: 25,
    isPopular: true,
    features: [
      'Unlimited Transactions',
      'Full AI CFO Advisor Access',
      'Advanced Balance Sheets',
      'Excel & PDF Exports',
      'Priority Email Support'
    ]
  },
  {
    id: 'executive',
    name: 'Executive Tier',
    price: 75,
    features: [
      'Multi-Entity Management',
      'Custom Audit Logging',
      'White-Glove Onboarding',
      'Dedicated Account Manager',
      '24/7 Telephone Support'
    ]
  }
];

// Cleared mock data to allow organizations to start with their own ledger
export const MOCK_TRANSACTIONS: Transaction[] = [];
