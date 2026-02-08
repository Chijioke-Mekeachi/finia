
import React, { useMemo } from 'react';
import { Transaction, BusinessSettings } from '../types';

interface BalanceSheetProps {
  transactions: Transaction[];
  settings: BusinessSettings;
}

const BalanceSheet: React.FC<BalanceSheetProps> = ({ transactions, settings }) => {
  const asOfDate = useMemo(() => {
    if (transactions.length === 0) return new Date();

    let latestTimestamp = Number.NEGATIVE_INFINITY;
    for (const transaction of transactions) {
      const ts = Date.parse(transaction.date);
      if (Number.isFinite(ts) && ts > latestTimestamp) latestTimestamp = ts;
    }

    return Number.isFinite(latestTimestamp) ? new Date(latestTimestamp) : new Date();
  }, [transactions]);

  const calculations = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);

    // With the current ledger model (income/expense cash-basis transactions only), we can only
    // derive cash position and cash deficit directly from the cash flow data.
    const netCashPosition = totalIncome - totalExpense;

    const assets = [{ name: 'Cash and Equivalents', amount: Math.max(0, netCashPosition) }];
    const liabilities = netCashPosition < 0
      ? [{ name: 'Bank Overdraft / Cash Deficit', amount: Math.abs(netCashPosition) }]
      : [];

    const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
    const equity = totalAssets - totalLiabilities;
    return { assets, liabilities, totalAssets, totalLiabilities, equity, totalIncome, totalExpense };
  }, [transactions]);

  const SectionHeader = ({ title }: { title: string }) => (
    <tr className="bg-slate-100 dark:bg-slate-800">
      <td colSpan={2} className="px-6 py-3 text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">{title}</td>
    </tr>
  );

  // Added key? to the prop type to resolve TS error when mapping components
  const Row = ({ name, amount, isTotal = false }: { name: string; amount: number; isTotal?: boolean; key?: string | number }) => (
    <tr className={`${isTotal ? 'bg-slate-50 dark:bg-slate-800/50 font-bold border-t-2 border-slate-200 dark:border-slate-700' : ''}`}>
      <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-300">{name}</td>
      <td className="px-6 py-4 text-sm text-right text-slate-900 dark:text-white font-mono">
        {settings.currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </td>
    </tr>
  );

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-[32px] overflow-hidden mb-12 transition-colors">
      <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Statement of Position</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">As of {asOfDate.toLocaleDateString()}</p>
        </div>
        <div className="text-right">
          <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest inline-block uppercase">Enterprise Grade</div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            <SectionHeader title="Assets" />
            {calculations.assets.map(a => <Row key={a.name} name={a.name} amount={a.amount} />)}
            <Row name="Total Assets" amount={calculations.totalAssets} isTotal />
            <SectionHeader title="Liabilities" />
            {calculations.liabilities.map(l => <Row key={l.name} name={l.name} amount={l.amount} />)}
            <Row name="Total Liabilities" amount={calculations.totalLiabilities} isTotal />
            <SectionHeader title="Equity" />
            <Row name="Net Position (Derived from Cash Flow)" amount={calculations.equity} />
            <tr className="bg-slate-900 dark:bg-blue-600 text-white font-black">
              <td className="px-8 py-8 uppercase tracking-widest text-xs">Total Liabilities & Equity</td>
              <td className="px-8 py-8 text-right font-mono text-xl">
                {settings.currency} {(calculations.totalLiabilities + calculations.equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BalanceSheet;
