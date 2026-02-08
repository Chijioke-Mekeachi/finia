
export type TransactionType = 'INCOME' | 'EXPENSE';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  description: string;
  entity: string;
}

export interface BusinessSettings {
  companyName: string;
  currency: string;
  fiscalYearStart: string;
  taxRate: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  isPopular?: boolean;
}

export type CompanyGoalStatus = 'active' | 'completed' | 'archived';

export interface CompanyGoal {
  id: string;
  title: string;
  description?: string | null;
  unit?: string | null;
  targetValue: number;
  currentValue: number;
  startDate?: string | null; // YYYY-MM-DD
  dueDate?: string | null; // YYYY-MM-DD
  status: CompanyGoalStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  margin: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TRANSACTIONS = 'TRANSACTIONS',
  GOALS = 'GOALS',
  BALANCE_SHEET = 'BALANCE_SHEET',
  AUDITING = 'AUDITING',
  REPORTS = 'REPORTS',
  AI_SECRETARY = 'AI_SECRETARY',
  SUBSCRIPTION = 'SUBSCRIPTION',
  SETTINGS = 'SETTINGS'
}

export type ReportPeriod = 'ALL' | 'THIS_MONTH' | 'LAST_QUARTER' | 'THIS_YEAR';
