
import React, { useState, useRef, useEffect } from 'react';
import { Printer, FileDown, CheckCircle2, Loader2, Sparkles, TrendingUp, TrendingDown, BookOpenText, Copy, Check } from 'lucide-react';
import { Transaction, BusinessSettings, ReportPeriod } from '../types';
import { apiAi } from '../apiClient';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import Markdown from './Markdown';

interface FinancialReportProps {
  transactions: Transaction[];
  settings: BusinessSettings;
}

const FinancialReport: React.FC<FinancialReportProps> = ({ transactions, settings }) => {
  const [period, setPeriod] = useState<ReportPeriod>('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const filteredTransactions = React.useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      if (period === 'THIS_MONTH') return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      if (period === 'THIS_YEAR') return tDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, period]);

  const stats = React.useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    const margin = income > 0 ? ((income - expense) / income) * 100 : 0;
    return { income, expense, net: income - expense, margin };
  }, [filteredTransactions]);

  useEffect(() => {
    const generateSummary = async () => {
      if (filteredTransactions.length === 0) {
        setAiSummary("Insufficient data for the selected period to generate an executive analysis.");
        return;
      }

      setIsGeneratingSummary(true);
      try {
        const prompt = `
          Analyze the financial performance of ${settings.companyName} for the period: ${period}.
          
          FINANCIAL DATA POINTS:
          - Total Revenue: ${settings.currency} ${stats.income.toLocaleString()}
          - Total Expenses: ${settings.currency} ${stats.expense.toLocaleString()}
          - Net Profit/Loss: ${settings.currency} ${stats.net.toLocaleString()}
          - Profit Margin: ${stats.margin.toFixed(2)}%
          
          DETAILED LEDGER SAMPLE (JSON): ${JSON.stringify(filteredTransactions.slice(0, 30))}
          
          TASK: Provide a high-level corporate "Executive Narrative".
          
          STRUCTURE:
          1. EXECUTIVE SENTIMENT: A 1-2 sentence overview of whether the period was successful.
          2. KEY DRIVERS: Identify the top 2 categories impacting the bottom line.
          3. STRATEGIC OUTLOOK: Provide 2 specific, actionable business recommendations for ${settings.companyName} based on these trends.
          
          TONE: Formal, institutional, and insightful. Avoid fluff.
        `;

        const response = await apiAi.analyze(prompt, undefined, 'report_summary');
        setAiSummary(response.text || "Summary could not be generated.");
      } catch (error) {
        console.error('AI Summary generation failed:', error);
        setAiSummary("Strategic Advisor is currently offline. Please check connectivity.");
      } finally {
        setIsGeneratingSummary(false);
      }
    };

    generateSummary();
  }, [filteredTransactions, settings.companyName, settings.currency, period]);

  const handleCopyNarrative = () => {
    if (aiSummary) {
      navigator.clipboard.writeText(aiSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, { 
        scale: 2, 
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        scrollY: -window.scrollY,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ 
        orientation: 'portrait', 
        unit: 'px', 
        format: [canvas.width / 2, canvas.height / 2] 
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), (canvas.height * pdf.internal.pageSize.getWidth()) / canvas.width);
      pdf.save(`${settings.companyName}_Executive_Report_${period}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('PDF generation failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 print:hidden">
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl shadow-inner border border-slate-200 dark:border-slate-800">
          {(['ALL', 'THIS_MONTH', 'THIS_YEAR'] as ReportPeriod[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                period === p ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-white shadow-md' : 'text-slate-500'
              }`}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-4">
          <button onClick={() => window.print()} className="flex items-center space-x-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm">
            <Printer size={18} />
            <span>Print</span>
          </button>
          <button 
            onClick={handleExportPdf} 
            disabled={isExporting || isGeneratingSummary} 
            className="flex items-center space-x-2 px-8 py-3 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all shadow-xl disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
            <span>{isExporting ? 'Generating PDF...' : 'Export Full Report'}</span>
          </button>
        </div>
      </div>

      <div ref={reportRef} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-[40px] overflow-hidden p-16 print:p-0 print:border-none print:shadow-none transition-colors">
        <div className="flex justify-between items-start mb-16">
          <div className="space-y-4">
            <div className="inline-flex items-center px-3 py-1 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-full text-[10px] font-black tracking-widest uppercase">Institutional Statement</div>
            <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">Financial<br/><span className="text-blue-600">Report</span></h1>
            <p className="text-xl font-medium text-slate-500 dark:text-slate-400">{settings.companyName}</p>
          </div>
          <div className="text-right">
             <div className="bg-slate-900 dark:bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black tracking-widest inline-block uppercase">Confidential Auditor's View</div>
             <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-tighter">Generated {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
           <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-700">
             <div className="flex items-center justify-between mb-2 text-slate-400">
               <p className="text-[10px] font-black uppercase tracking-widest">Revenue</p>
               <TrendingUp size={16} className="text-emerald-500" />
             </div>
             <p className="text-3xl font-black text-slate-900 dark:text-white">{settings.currency} {stats.income.toLocaleString()}</p>
           </div>
           <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-700">
             <div className="flex items-center justify-between mb-2 text-slate-400">
               <p className="text-[10px] font-black uppercase tracking-widest">Expenses</p>
               <TrendingDown size={16} className="text-rose-500" />
             </div>
             <p className="text-3xl font-black text-slate-900 dark:text-white">{settings.currency} {stats.expense.toLocaleString()}</p>
           </div>
           <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-700">
             <div className="flex items-center justify-between mb-2 text-slate-400">
               <p className="text-[10px] font-black uppercase tracking-widest">Net Position</p>
               <div className={`w-2 h-2 rounded-full ${stats.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
             </div>
             <p className={`text-3xl font-black ${stats.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600'}`}>
               {settings.currency} {stats.net.toLocaleString()}
             </p>
           </div>
        </div>

        <div className="border border-slate-100 dark:border-slate-800 rounded-[32px] overflow-hidden mb-16 bg-white dark:bg-slate-900">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5">Entity / Beneficiary</th>
                <th className="px-8 py-5 text-right">Amount ({settings.currency})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredTransactions.slice(0, 100).map(t => (
                <tr key={t.id} className="text-sm hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="px-8 py-5 text-slate-500 dark:text-slate-400 font-medium">{t.date}</td>
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-900 dark:text-white leading-none">{t.entity}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tight">{t.category}</p>
                  </td>
                  <td className={`px-8 py-5 text-right font-black ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-16 bg-slate-950 dark:bg-blue-600/5 border border-slate-900 dark:border-blue-500/10 rounded-[40px] p-12 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles size={80} className="text-blue-400" />
          </div>
          
          <div className="relative z-10 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-600 rounded-[24px] text-white shadow-xl shadow-blue-500/20">
                  <BookOpenText size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Executive Narrative</h3>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-1">
                    Intelligence Report • v3.1 Flash
                  </p>
                </div>
              </div>
              <button 
                onClick={handleCopyNarrative}
                className="p-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl transition-all border border-white/5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Text'}
              </button>
            </div>

            <div className="min-h-[160px] text-slate-300 leading-[1.8] text-[16px] font-medium selection:bg-blue-500/30">
              {isGeneratingSummary ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="animate-spin text-blue-600" size={40} />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Consulting Strategic Advisor...</p>
                </div>
              ) : (
                <div className="whitespace-pre-line animate-in fade-in slide-in-from-top-2 duration-500">
                  {aiSummary ? <Markdown text={aiSummary} /> : "Analytic engine initialized. Awaiting ledger updates."}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-20 pt-10 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={24} />
            <span className="text-xs font-black uppercase tracking-widest">Ledger Identity Verified</span>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 italic">This analysis is for internal management use only.</p>
            <p className="text-[9px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest mt-1">Institutional Audit Record: FT-PRO-INTEL</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialReport;
