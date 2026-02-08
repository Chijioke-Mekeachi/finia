
import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, ArrowUpRight, ArrowDownLeft, X, FileSpreadsheet, ScanLine, History } from 'lucide-react';
import { Transaction, TransactionType, BusinessSettings } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../constants';
import * as XLSX from 'xlsx';
import ReceiptScanner from './ReceiptScanner';

interface TransactionListProps {
  transactions: Transaction[];
  onAdd: (t: Omit<Transaction, 'id'>) => void;
  onDelete: (id: string) => void;
  settings: BusinessSettings;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onAdd, onDelete, settings }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'EXPENSE' as TransactionType,
    category: '',
    amount: '',
    description: '',
    entity: ''
  });

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => 
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transactions, searchTerm]);

  // Extract unique historical data for intelligent suggestions
  const suggestions = useMemo(() => {
    const entities = [...new Set(transactions.map(t => t.entity))].sort();
    const memos = [...new Set(transactions.map(t => t.description))].filter(Boolean).sort();
    const categories = [...new Set(transactions.map(t => t.category))].sort();
    return { entities, memos, categories };
  }, [transactions]);

  const handleExportExcel = () => {
    try {
      const excelData = filteredTransactions.map(t => ({
        'Date': t.date,
        'Entity': t.entity,
        'Type': t.type,
        'Category': t.category,
        [`Amount (${settings.currency})`]: t.amount,
        'Memo': t.description
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const wscols = [{ wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 40 }];
      worksheet['!cols'] = wscols;
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
      const timestamp = new Date().toISOString().split('T')[0];
      const sanitizedCompanyName = settings.companyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      XLSX.writeFile(workbook, `${sanitizedCompanyName}_ledger_${timestamp}.xlsx`);
    } catch (error) {
      console.error('Excel Export Error:', error);
      alert('Failed to generate Excel file.');
    }
  };

  const handleScannedData = (data: Partial<Transaction>) => {
    setFormData({
      date: data.date || new Date().toISOString().split('T')[0],
      type: 'EXPENSE',
      category: data.category || '',
      amount: data.amount?.toString() || '',
      description: data.description || '',
      entity: data.entity || ''
    });
    setShowScanner(false);
    setIsAdding(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.entity || !formData.category) return;
    onAdd({
      date: formData.date,
      type: formData.type,
      category: formData.category,
      amount: parseFloat(formData.amount),
      description: formData.description,
      entity: formData.entity
    });
    setIsAdding(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'EXPENSE',
      category: '',
      amount: '',
      description: '',
      entity: ''
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 dark:focus:border-blue-400 transition-all shadow-sm text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm font-bold active:scale-95"
          >
            <ScanLine size={20} />
            <span>Scan Receipt</span>
          </button>
          
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center space-x-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm font-semibold active:scale-95"
          >
            <FileSpreadsheet size={20} className="text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          
          <button
            onClick={() => setIsAdding(!isAdding)}
            className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-2xl transition-all shadow-lg font-bold active:scale-95 ${
              isAdding 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' 
                : 'bg-blue-600 text-white shadow-blue-500/20'
            }`}
          >
            {isAdding ? <X size={20} /> : <Plus size={20} />}
            <span>{isAdding ? 'Cancel' : 'Manual Entry'}</span>
          </button>
        </div>
      </div>

      {showScanner && (
        <ReceiptScanner 
          settings={settings} 
          onScanned={handleScannedData} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl grid grid-cols-1 md:grid-cols-3 gap-6 animate-in zoom-in duration-300">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 dark:text-white font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nature of Funds</label>
            <select
              value={formData.type}
              onChange={e => {
                const type = e.target.value as TransactionType;
                setFormData({
                  ...formData, 
                  type, 
                  category: '' // Reset category so they can pick/type a new one for this type
                });
              }}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 dark:text-white font-medium"
            >
              <option value="INCOME">Revenue / Credit (+)</option>
              <option value="EXPENSE">Burn / Debit (-)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Classification</label>
            <div className="relative group">
              <input
                list="category-suggestions"
                required
                placeholder="Pick or Type Category..."
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 dark:text-white font-medium"
              />
              <datalist id="category-suggestions">
                {(formData.type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => (
                  <option key={cat} value={cat} />
                ))}
                {/* Historical custom categories used by user */}
                {suggestions.categories.map(cat => (
                  <option key={`hist-${cat}`} value={cat} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Monetary Value ({settings.currency})</label>
            <input
              type="number"
              required
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: e.target.value})}
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 dark:text-white font-black text-lg"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Counterparty (Entity)</label>
            <div className="relative group">
              <input
                list="entity-suggestions"
                type="text"
                required
                placeholder="Vendor, Client, or Employee..."
                value={formData.entity}
                onChange={e => setFormData({...formData, entity: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 dark:text-white font-medium"
              />
              <datalist id="entity-suggestions">
                {suggestions.entities.map(ent => (
                  <option key={ent} value={ent} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Memo / Internal Note</label>
            <div className="relative group">
              <input
                list="memo-suggestions"
                type="text"
                placeholder="Business justification..."
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-slate-900 dark:text-white font-medium"
              />
              <datalist id="memo-suggestions">
                {suggestions.memos.map(memo => (
                  <option key={memo} value={memo} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="md:col-span-3 pt-2">
            <button type="submit" className="w-full bg-slate-900 dark:bg-blue-600 text-white py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[11px] hover:opacity-90 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3">
              <Plus size={18} />
              Finalize Ledger Entry
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Posting Date</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Entity / Beneficiary</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Classification</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Value ({settings.currency})</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                       <History size={48} className="text-slate-300" />
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No Historical Data Found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                    <td className="px-8 py-5 text-sm font-semibold text-slate-500 dark:text-slate-400">{t.date}</td>
                    <td className="px-8 py-5">
                      <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">{t.entity}</p>
                      <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic truncate max-w-xs">{t.description || 'No memo'}</p>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                        {t.category}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className={`inline-flex items-center justify-end font-black text-sm ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                        {t.type === 'INCOME' ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownLeft size={14} className="mr-1" />}
                        {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button 
                        onClick={() => onDelete(t.id)}
                        className="text-slate-300 dark:text-slate-600 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionList;
