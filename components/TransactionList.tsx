
import React, { useState, useMemo } from 'react';
import { Plus, Search, Trash2, ArrowUpRight, ArrowDownLeft, X, FileSpreadsheet, ScanLine, History, Upload } from 'lucide-react';
import { Transaction, TransactionType, BusinessSettings } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../constants';
import * as XLSX from 'xlsx';
import ReceiptScanner from './ReceiptScanner';

interface TransactionListProps {
  transactions: Transaction[];
  onAdd: (t: Omit<Transaction, 'id'>) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  settings: BusinessSettings;
}

type ImportedRow = {
  rowNumber: number;
  tx?: Omit<Transaction, 'id'>;
  errors: string[];
  isDuplicate?: boolean;
  duplicateHint?: string;
};

type ColumnMapping = {
  dateKey: string;
  entityKey: string;
  categoryKey: string;
  amountKey: string;
  typeKey?: string;
  descriptionKey?: string;
};

const normalizeHeader = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const pickKey = (keys: string[], candidates: string[]) => {
  const byNorm = new Map<string, string>();
  keys.forEach((k) => byNorm.set(normalizeHeader(k), k));
  for (const c of candidates) {
    const exact = byNorm.get(c);
    if (exact) return exact;
  }
  return undefined;
};

const parseToISODate = (value: any): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const y = String(parsed.y).padStart(4, '0');
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = Number(m[3]);
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
      return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
    }
    if (b >= 1 && b <= 12 && a >= 1 && a <= 31) {
      return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }
  }

  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
};

const parseAmount = (value: any): { amount: number | null; wasNegative: boolean } => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { amount: Math.abs(value), wasNegative: value < 0 };
  }
  const raw = String(value ?? '').trim();
  if (!raw) return { amount: null, wasNegative: false };
  const parensNegative = /^\(.*\)$/.test(raw);
  const cleaned = raw
    .replace(/[,$\s]/g, '')
    .replace(/^\(/, '')
    .replace(/\)$/, '')
    .replace(/[^0-9.+-]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { amount: null, wasNegative: false };
  const wasNegative = parensNegative || n < 0;
  return { amount: Math.abs(n), wasNegative };
};

const parseType = (value: any): TransactionType | null => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'income' || raw === 'revenue' || raw === 'credit' || raw === 'in' || raw === '+') return 'INCOME';
  if (raw === 'expense' || raw === 'burn' || raw === 'debit' || raw === 'out' || raw === '-') return 'EXPENSE';
  if (raw.includes('income') || raw.includes('revenue') || raw.includes('credit') || raw === 'inflow') return 'INCOME';
  if (raw.includes('expense') || raw.includes('debit') || raw.includes('burn') || raw === 'outflow') return 'EXPENSE';
  return null;
};

const normalizeText = (value: any) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const amountKey2dp = (amount: number) => (Math.round(amount * 100) / 100).toFixed(2);

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onAdd, onDelete, settings }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importDefaultType, setImportDefaultType] = useState<TransactionType>('EXPENSE');
  const [importFileName, setImportFileName] = useState('');
  const [importRawRecords, setImportRawRecords] = useState<Record<string, any>[]>([]);
  const [importMapping, setImportMapping] = useState<ColumnMapping | null>(null);
  const [importRows, setImportRows] = useState<ImportedRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, failed: 0 });
  const [importDuplicateDecision, setImportDuplicateDecision] = useState<'skip' | 'include' | null>(null);
  
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

  const existingNoTypeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const t of transactions) {
      const key = [
        String(t.date || '').slice(0, 10),
        normalizeText(t.entity),
        normalizeText(t.category),
        amountKey2dp(Number(t.amount) || 0),
      ].join('|');
      keys.add(key);
    }
    return keys;
  }, [transactions]);

  const existingWithTypeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const t of transactions) {
      const base = [
        String(t.date || '').slice(0, 10),
        normalizeText(t.entity),
        normalizeText(t.category),
        amountKey2dp(Number(t.amount) || 0),
      ].join('|');
      keys.add(`${base}|${t.type}`);
    }
    return keys;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.entity || !formData.category) return;
    await Promise.resolve(onAdd({
      date: formData.date,
      type: formData.type,
      category: formData.category,
      amount: parseFloat(formData.amount),
      description: formData.description,
      entity: formData.entity
    }));
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

  const detectMapping = (records: Record<string, any>[]): ColumnMapping => {
    const first = records.find((r) => r && typeof r === 'object') || {};
    const keys = Object.keys(first);
    if (keys.length === 0) throw new Error('No columns found');

    const dateKey = pickKey(keys, ['date', 'postingdate', 'transactiondate']) || pickKey(keys, ['datetime', 'createdat']);
    const entityKey = pickKey(keys, ['entity', 'beneficiary', 'vendor', 'counterparty', 'payee', 'name']);
    const categoryKey = pickKey(keys, ['category', 'classification', 'class']);
    const typeKey = pickKey(keys, ['type', 'natureoffunds', 'incomeexpense', 'direction']);
    const descriptionKey = pickKey(keys, ['memo', 'description', 'note', 'details']);

    let amountKey = pickKey(keys, ['amount', 'value', 'monetaryvalue']);
    if (!amountKey) {
      const amountLike = keys.find((k) => normalizeHeader(k).startsWith('amount'));
      if (amountLike) amountKey = amountLike;
    }

    if (!dateKey) throw new Error('Missing a date column (expected: Date)');
    if (!entityKey) throw new Error('Missing an entity column (expected: Entity / Vendor / Payee)');
    if (!categoryKey) throw new Error('Missing a category column (expected: Category)');
    if (!amountKey) throw new Error('Missing an amount column (expected: Amount)');

    return {
      dateKey,
      entityKey,
      categoryKey,
      amountKey,
      typeKey: typeKey || undefined,
      descriptionKey: descriptionKey || undefined,
    };
  };

  const buildImportRows = (records: Record<string, any>[], mapping: ColumnMapping, defaultType: TransactionType): ImportedRow[] => {
    const maxRows = 1000;
    const sliced = records.slice(0, maxRows);
    const out: ImportedRow[] = [];
    const seenInFileNoType = new Set<string>();

    for (let idx = 0; idx < sliced.length; idx++) {
      const row = sliced[idx];
      const errors: string[] = [];

      const date = parseToISODate(row[mapping.dateKey]);
      if (!date) errors.push('Invalid/missing date');

      const entity = String(row[mapping.entityKey] ?? '').trim();
      if (!entity) errors.push('Missing entity');

      const category = String(row[mapping.categoryKey] ?? '').trim();
      if (!category) errors.push('Missing category');

      const { amount, wasNegative } = parseAmount(row[mapping.amountKey]);
      if (amount === null || !(amount > 0)) errors.push('Invalid/missing amount');

      const maybeType = mapping.typeKey ? parseType(row[mapping.typeKey]) : null;
      const inferredType = maybeType || (wasNegative ? 'EXPENSE' : defaultType);

      const description = mapping.descriptionKey ? String(row[mapping.descriptionKey] ?? '').trim() : '';

      let tx: Omit<Transaction, 'id'> | undefined;
      let isDuplicate = false;
      let duplicateHint: string | undefined;

      if (errors.length === 0) {
        tx = {
          date: date!,
          type: inferredType,
          category,
          amount: amount!,
          description,
          entity,
        };

        const baseKey = [tx.date, normalizeText(tx.entity), normalizeText(tx.category), amountKey2dp(tx.amount)].join('|');
        const withType = `${baseKey}|${tx.type}`;

        if (seenInFileNoType.has(baseKey)) {
          isDuplicate = true;
          duplicateHint = 'Duplicate within import file';
        } else if (existingNoTypeKeys.has(baseKey)) {
          isDuplicate = true;
          duplicateHint = existingWithTypeKeys.has(withType)
            ? 'Already exists in your cash flow'
            : 'Similar entry exists (type differs)';
        }
        seenInFileNoType.add(baseKey);
      }

      out.push({ rowNumber: idx + 2, tx, errors, isDuplicate: isDuplicate || undefined, duplicateHint });
    }
    return out;
  };

  const parseImportFile = async (file: File): Promise<Record<string, any>[]> => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'json') {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const records = Array.isArray(parsed) ? parsed : Array.isArray((parsed as any)?.transactions) ? (parsed as any).transactions : null;
      if (!records) throw new Error('JSON must be an array of rows or an export containing { transactions: [...] }');
      return records.filter((r: any) => r && typeof r === 'object');
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) throw new Error('No sheets found in file');
    const ws = wb.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(ws, { defval: '', blankrows: false }) as Record<string, any>[];
    if (!records.length) throw new Error('No rows found in sheet');
    return records;
  };

  const openImportWithFile = async (file: File) => {
    setImportError(null);
    setImportFileName(file.name);
    setImportOpen(true);
    setImporting(false);
    setImportProgress({ done: 0, total: 0, failed: 0 });
    setImportDuplicateDecision(null);
    try {
      const records = await parseImportFile(file);
      const mapping = detectMapping(records);
      setImportRawRecords(records);
      setImportMapping(mapping);
      const rows = buildImportRows(records, mapping, importDefaultType);
      setImportRows(rows);
      const dupCount = rows.filter((r) => r.tx && r.isDuplicate).length;
      setImportDuplicateDecision(dupCount > 0 ? null : 'skip');
    } catch (e: any) {
      setImportRawRecords([]);
      setImportMapping(null);
      setImportRows([]);
      setImportError(e?.message || 'Failed to parse file');
    }
  };

  const confirmImport = async () => {
    if (!importMapping) return;

    const rows = buildImportRows(importRawRecords, importMapping, importDefaultType);
    setImportRows(rows);
    const dupCount = rows.filter((r) => r.tx && r.isDuplicate).length;
    if (dupCount > 0 && importDuplicateDecision === null) {
      setImportError('Duplicates detected. Choose whether to skip or include them.');
      return;
    }

    const includeDuplicates = importDuplicateDecision === 'include';
    const valid = rows
      .filter((r) => r.tx)
      .filter((r) => includeDuplicates || !r.isDuplicate)
      .map((r) => r.tx!) as Omit<Transaction, 'id'>[];
    if (!valid.length) {
      setImportError('No valid rows to import.');
      return;
    }

    setImportError(null);
    setImporting(true);
    setImportProgress({ done: 0, total: valid.length, failed: 0 });

    let failed = 0;
    for (let i = 0; i < valid.length; i++) {
      try {
        await Promise.resolve(onAdd(valid[i]));
      } catch (e) {
        failed += 1;
      } finally {
        setImportProgress({ done: i + 1, total: valid.length, failed });
      }
    }

    setImporting(false);
    if (failed > 0) {
      setImportError(`Imported with ${failed} failed row(s).`);
      return;
    }
    setImportOpen(false);
  };

  const validCount = importRows.filter((r) => r.tx).length;
  const duplicateCount = importRows.filter((r) => r.tx && r.isDuplicate).length;
  const invalidCount = importRows.filter((r) => !r.tx).length;
  const includeDuplicates = importDuplicateDecision === 'include';
  const readyCount = includeDuplicates ? validCount : importDuplicateDecision === 'skip' ? validCount - duplicateCount : validCount;
  const willImportRows = importRows.filter((r) => r.tx).filter((r) => includeDuplicates || !r.isDuplicate);

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

	          <label className="flex items-center justify-center space-x-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm font-semibold active:scale-95 cursor-pointer">
	            <input
	              type="file"
	              accept=".xlsx,.xls,.csv,.json"
	              className="hidden"
	              onChange={(e) => {
	                const f = e.target.files?.[0];
	                if (f) void openImportWithFile(f);
	                e.currentTarget.value = '';
	              }}
	            />
	            <Upload size={20} className="text-blue-600" />
	            <span className="hidden sm:inline">Import</span>
	          </label>
	          
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

	      {importOpen && (
	        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-6">
	          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] shadow-2xl overflow-hidden">
	            <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 dark:border-slate-800">
	              <div>
	                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cash Flow Import</p>
	                <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
	                  {importFileName || 'Import Transactions'}
	                </h3>
	              </div>
	              <button
	                onClick={() => {
	                  if (importing) return;
	                  setImportOpen(false);
	                  setImportError(null);
	                }}
	                className="p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
	              >
	                <X size={18} />
	              </button>
	            </div>

	            <div className="px-7 py-6 space-y-5">
	              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
	                <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
	                  <span className="font-black text-slate-900 dark:text-white">{readyCount}</span> ready ·{' '}
	                  <span className="font-black text-slate-900 dark:text-white">{duplicateCount}</span> duplicates ·{' '}
	                  <span className="font-black text-slate-900 dark:text-white">{invalidCount}</span> invalid
	                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">(max 1000 rows)</span>
	                </div>
	                <div className="flex items-center gap-2">
	                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Default Type</label>
	                  <select
	                    value={importDefaultType}
	                    onChange={(e) => {
	                      const v = e.target.value as TransactionType;
	                      setImportDefaultType(v);
	                      if (importMapping) {
	                        const rows = buildImportRows(importRawRecords, importMapping, v);
	                        setImportRows(rows);
	                        const dups = rows.filter((r) => r.tx && r.isDuplicate).length;
	                        setImportDuplicateDecision(dups > 0 ? importDuplicateDecision : 'skip');
	                      }
	                    }}
	                    disabled={importing}
	                    className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-900 dark:text-white"
	                  >
	                    <option value="INCOME">INCOME</option>
	                    <option value="EXPENSE">EXPENSE</option>
	                  </select>
	                </div>
	              </div>

	              <div className="text-xs text-slate-500 dark:text-slate-400">
	                Supported: <span className="font-semibold">.xlsx</span>, <span className="font-semibold">.csv</span>, <span className="font-semibold">.json</span>. Easiest path: export via the <span className="font-semibold">Excel</span> button, fill rows, then import the same file back.
	              </div>

	              {duplicateCount > 0 && (
	                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-800 dark:text-amber-200">
	                  <p className="text-sm font-black">Similar entries detected</p>
	                  <p className="text-xs font-semibold mt-1">
	                    {duplicateCount} row(s) look like transactions you already have (or duplicates within this file). Choose what to do with duplicates:
	                  </p>
	                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
	                    <button
	                      onClick={() => {
	                        setImportDuplicateDecision('skip');
	                        setImportError(null);
	                      }}
	                      disabled={importing}
	                      className={`px-4 py-2 rounded-2xl border font-bold transition-all active:scale-95 ${
	                        importDuplicateDecision === 'skip'
	                          ? 'bg-amber-600 border-amber-600 text-white'
	                          : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-100 hover:bg-amber-100/60 dark:hover:bg-amber-500/10'
	                      }`}
	                    >
	                      Skip duplicates (recommended)
	                    </button>
	                    <button
	                      onClick={() => {
	                        setImportDuplicateDecision('include');
	                        setImportError(null);
	                      }}
	                      disabled={importing}
	                      className={`px-4 py-2 rounded-2xl border font-bold transition-all active:scale-95 ${
	                        importDuplicateDecision === 'include'
	                          ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-600 text-white'
	                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
	                      }`}
	                    >
	                      Import all (include duplicates)
	                    </button>
	                  </div>
	                  {importDuplicateDecision === null && (
	                    <p className="mt-2 text-xs font-semibold text-amber-700 dark:text-amber-200">
	                      Import is disabled until you choose an option.
	                    </p>
	                  )}
	                </div>
	              )}

	              {importError && (
	                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-sm font-semibold">
	                  {importError}
	                  <div className="mt-2 text-xs text-rose-600/80 dark:text-rose-300/80">
	                    Expected columns like: Date, Entity, Category, Amount (optional: Type, Memo/Description).
	                  </div>
	                </div>
	              )}

	              {importing && (
	                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
	                  <div className="flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-200">
	                    <span>Importing…</span>
	                    <span>
	                      {importProgress.done}/{importProgress.total} ({importProgress.failed} failed)
	                    </span>
	                  </div>
	                  <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
	                    <div
	                      className="h-full bg-blue-600"
	                      style={{
	                        width: `${importProgress.total ? Math.round((importProgress.done / importProgress.total) * 100) : 0}%`,
	                      }}
	                    />
	                  </div>
	                </div>
	              )}

	              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
	                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Preview</p>
	                  <div className="space-y-2 max-h-56 overflow-auto pr-1 custom-scrollbar">
	                    {willImportRows.slice(0, 8).map((r) => (
	                      <div key={r.rowNumber} className="flex items-center justify-between text-sm">
	                        <div className="min-w-0">
	                          <p className="font-black text-slate-900 dark:text-white truncate">{r.tx!.entity}</p>
	                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
	                            {r.tx!.date} · {r.tx!.category} · {r.tx!.type}
	                          </p>
	                        </div>
	                        <div className="font-black text-slate-900 dark:text-white ml-3">
	                          {r.tx!.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
	                        </div>
	                      </div>
	                    ))}
	                    {validCount === 0 && (
	                      <p className="text-sm text-slate-500 dark:text-slate-400">No valid rows detected.</p>
	                    )}
	                  </div>
	                </div>

	                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
	                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Duplicates / Invalid</p>
	                  <div className="space-y-2 max-h-56 overflow-auto pr-1 custom-scrollbar">
	                    {importRows.filter((r) => r.tx && r.isDuplicate).slice(0, 8).map((r) => (
	                      <div key={`dup-${r.rowNumber}`} className="text-sm">
	                        <p className="font-black text-slate-900 dark:text-white">Row {r.rowNumber} (duplicate)</p>
	                        <p className="text-[11px] text-amber-700 dark:text-amber-200">{r.duplicateHint || 'Similar entry detected'}</p>
	                      </div>
	                    ))}
	                    {importRows.filter((r) => !r.tx).slice(0, 8).map((r) => (
	                      <div key={r.rowNumber} className="text-sm">
	                        <p className="font-black text-slate-900 dark:text-white">Row {r.rowNumber}</p>
	                        <p className="text-[11px] text-rose-600 dark:text-rose-300">{r.errors.join(', ')}</p>
	                      </div>
	                    ))}
	                    {duplicateCount === 0 && invalidCount === 0 && (
	                      <p className="text-sm text-slate-500 dark:text-slate-400">No skipped rows.</p>
	                    )}
	                  </div>
	                </div>
	              </div>
	            </div>

	            <div className="px-7 py-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
	              <button
	                onClick={() => {
	                  if (importing) return;
	                  setImportOpen(false);
	                }}
	                className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
	                disabled={importing}
	              >
	                Close
	              </button>
	              <button
	                onClick={() => void confirmImport()}
	                className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black hover:opacity-90 transition-all shadow-lg active:scale-95 disabled:opacity-50"
	                disabled={importing || readyCount <= 0 || !!importError || (duplicateCount > 0 && importDuplicateDecision === null)}
	              >
	                Import {readyCount > 0 ? `(${readyCount})` : ''}
	              </button>
	            </div>
	          </div>
	        </div>
	      )}

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
	                        onClick={() => void onDelete(t.id)}
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
