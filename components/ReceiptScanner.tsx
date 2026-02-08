
import React, { useState, useRef } from 'react';
import { Upload, Loader2, CheckCircle2, X, FileSearch, Sparkles, AlertCircle } from 'lucide-react';
import { apiAi } from '../apiClient';
import { Transaction, BusinessSettings } from '../types';
import { EXPENSE_CATEGORIES } from '../constants';

interface ReceiptScannerProps {
  settings: BusinessSettings;
  onScanned: (data: Partial<Transaction>) => void;
  onClose: () => void;
}

const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ settings, onScanned, onClose }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImage(result);
        processReceipt(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const processReceipt = async (base64Data: string) => {
    setIsProcessing(true);
    setError(null);
    try {
      const base64Content = base64Data.split(',')[1];
      
      const prompt = `You are a professional corporate auditor. Extract data from this receipt into JSON format. 
Use these categories if possible: ${EXPENSE_CATEGORIES.join(', ')}.
Return ONLY JSON with this structure: { "date": "YYYY-MM-DD", "amount": number, "entity": "Vendor Name", "category": "Category Name", "description": "Short summary" }`;

      const response = await apiAi.vision(prompt, base64Content, 'image/jpeg', undefined, 'receipt_scan');

      if (!response.text) {
        throw new Error("Analysis failed: Empty response from AI.");
      }

      const result = JSON.parse(response.text);
      onScanned({
        ...result,
        type: 'EXPENSE'
      });
    } catch (err: any) {
      console.error('Vision extraction error:', err);
      setError(err?.message || 'Failed to interpret receipt. Please ensure image clarity.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[40px] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg">
              <FileSearch size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white leading-none mb-1">Vision Ledger</h3>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={12} />
                AI-Powered Extraction
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-10 text-center">
          {!image ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-4 border-dashed border-slate-100 dark:border-slate-800 rounded-[32px] p-16 hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-500/5 transition-all cursor-pointer group"
            >
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload size={32} className="text-slate-400 group-hover:text-blue-600" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Upload Corporate Receipt</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Drag and drop your file here, or click to browse. Supports JPG, PNG.
              </p>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            </div>
          ) : (
            <div className="space-y-8 animate-in zoom-in duration-300">
              <div className="relative inline-block">
                <img src={image} alt="Receipt" className="max-h-64 rounded-2xl shadow-xl mx-auto border-4 border-white dark:border-slate-800" />
                {isProcessing && (
                  <div className="absolute inset-0 bg-blue-600/20 backdrop-blur-[2px] rounded-2xl flex items-center justify-center overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-[bounce_2s_infinite]"></div>
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 size={32} className="animate-spin text-white" />
                      <span className="text-white text-[10px] font-black uppercase tracking-widest">Analyzing Data...</span>
                    </div>
                  </div>
                )}
                {!isProcessing && !error && (
                  <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg animate-in scale-in">
                    <CheckCircle2 size={24} />
                  </div>
                )}
              </div>

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs font-bold text-left">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-4">
                <button 
                  onClick={() => setImage(null)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all"
                >
                  Retake / Reset
                </button>
                <button 
                  disabled={isProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  Upload New
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="px-10 pb-10 flex items-center justify-center gap-3 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
          <ShieldCheck size={14} className="text-emerald-500" />
          Secure Enterprise-Grade Vision Processing Active
        </div>
      </div>
    </div>
  );
};

const ShieldCheck = ({ size, className }: { size: number, className: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export default ReceiptScanner;
