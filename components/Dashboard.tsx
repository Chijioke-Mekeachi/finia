
import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Line,
  ComposedChart,
  Legend
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Wallet, Activity, CreditCard, PieChart as PieIcon, BarChart3, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { Transaction, FinancialSummary, BusinessSettings } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  settings: BusinessSettings;
}

const COLORS = ['#1e293b', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

const Dashboard: React.FC<DashboardProps> = ({ transactions, settings }) => {
  const summary = useMemo<FinancialSummary>(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
    const net = income - expenses;
    const margin = income === 0 ? 0 : (net / income) * 100;
    return { totalIncome: income, totalExpenses: expenses, netProfit: net, margin };
  }, [transactions]);

  const analyticalData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const groups: Record<string, { income: number; expense: number; net: number }> = {};
    
    // Initialize months
    months.forEach(m => groups[m] = { income: 0, expense: 0, net: 0 });

    transactions.forEach(t => {
      const dateObj = new Date(t.date);
      const month = dateObj.toLocaleString('default', { month: 'short' });
      if (groups[month]) {
        if (t.type === 'INCOME') groups[month].income += t.amount;
        else groups[month].expense += t.amount;
        groups[month].net = groups[month].income - groups[month].expense;
      }
    });

    return Object.entries(groups).map(([name, data]) => ({ name, ...data }));
  }, [transactions]);

  const expenseByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      data[t.category] = (data[t.category] || 0) + t.amount;
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // Pareto sort
  }, [transactions]);

  const hasData = transactions.length > 0;

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Institutional KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          label="Gross Operating Revenue" 
          value={summary.totalIncome} 
          settings={settings}
          icon={<DollarSign size={20} />} 
          color="blue"
          subtext="Total Incoming Capital"
        />
        <KPICard 
          label="Operational Expenditure" 
          value={summary.totalExpenses} 
          settings={settings}
          icon={<CreditCard size={20} />} 
          color="rose"
          subtext="Opex / Accrued Burn"
        />
        <KPICard 
          label="Net Operating Income" 
          value={summary.netProfit} 
          settings={settings}
          icon={<Activity size={20} />} 
          color="emerald"
          subtext="EBITDA Equivalent"
        />
        <KPICard 
          label="Net Profit Margin" 
          value={summary.margin} 
          settings={settings}
          isPercent
          icon={<Wallet size={20} />} 
          color="slate"
          subtext="Revenue Efficiency"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Treasury Performance Matrix */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={18} className="text-blue-600" />
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Performance Matrix</h3>
              </div>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monthly Cash Inflow vs Outflow Correlation</p>
            </div>
            <div className="flex gap-6">
               <LegendItem color="#2563eb" label="Revenue" />
               <LegendItem color="#cbd5e1" label="Expense" />
               <LegendItem color="#10b981" label="Net Pos." isLine />
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            {!hasData ? (
              <EmptyState message="Awaiting ledger initialization to generate performance matrix." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={analyticalData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeOpacity={0.2} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                    tickFormatter={(val) => `${settings.currency} ${val > 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
                      padding: '16px'
                    }}
                    itemStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', textTransform: 'uppercase' }}
                    labelStyle={{ fontSize: '10px', color: '#64748b', fontWeight: 800, marginBottom: '8px', letterSpacing: '0.1em' }}
                    cursor={{ fill: '#f1f5f9', opacity: 0.1 }}
                  />
                  <Bar dataKey="income" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={12} name="Income" />
                  <Bar dataKey="expense" fill="#cbd5e1" radius={[6, 6, 0, 0]} barSize={12} name="Expense" />
                  <Line 
                    type="monotone" 
                    dataKey="net" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    name="Net Position"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Cost Concentration & Allocation */}
        <div className="flex flex-col gap-8">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm flex-1">
            <div className="flex items-center gap-2 mb-6">
              <PieIcon size={18} className="text-slate-900 dark:text-white" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Cost Concentration</h3>
            </div>
            
            <div className="h-48 relative mb-8">
              {!hasData ? (
                <EmptyState mini />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {expenseByCategory.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {hasData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Burn</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                    {summary.totalExpenses.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
               {expenseByCategory.slice(0, 4).map((item, i) => (
                 <div key={item.name} className="flex items-center justify-between group">
                   <div className="flex items-center gap-3">
                     <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                     <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">{item.name}</span>
                   </div>
                   <div className="text-right">
                     <p className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                       {settings.currency} {item.value.toLocaleString()}
                     </p>
                   </div>
                 </div>
               ))}
               {expenseByCategory.length === 0 && (
                 <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest italic py-4">No categories recorded</p>
               )}
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-xl shadow-slate-950/20">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Strategic Health</h4>
            <div className="space-y-6">
              <HealthMetric 
                label="Burn Rate Efficiency" 
                percent={summary.totalIncome > 0 ? (summary.totalExpenses / summary.totalIncome) * 100 : 0} 
                inverse
              />
              <HealthMetric 
                label="Retained Earnings" 
                percent={summary.margin} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const KPICard = ({ label, value, settings, isPercent, icon, color, subtext }: any) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-600 text-white shadow-blue-500/20',
    rose: 'bg-rose-500 text-white shadow-rose-500/20',
    emerald: 'bg-emerald-500 text-white shadow-emerald-500/20',
    slate: 'bg-slate-900 dark:bg-slate-800 text-white shadow-slate-900/20',
  };
  
  return (
    <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className={`p-3.5 rounded-2xl ${colorMap[color] || ''}`}>{icon}</div>
        {value !== 0 && (
          <div className={`flex items-center text-[10px] font-black px-2.5 py-1 rounded-full ${value >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'}`}>
            {value >= 0 ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownLeft size={12} className="mr-1" />}
            SYSTEM OK
          </div>
        )}
      </div>
      <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <h4 className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
        {isPercent ? `${value.toFixed(1)}%` : `${settings.currency} ${value.toLocaleString()}`}
      </h4>
      <p className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-tighter mt-2">{subtext}</p>
    </div>
  );
};

const LegendItem = ({ color, label, isLine = false }: { color: string, label: string, isLine?: boolean }) => (
  <div className="flex items-center gap-2">
    {isLine ? (
      <div className="flex items-center">
        <div className="w-3 h-0.5" style={{backgroundColor: color}}></div>
        <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: color}}></div>
        <div className="w-3 h-0.5" style={{backgroundColor: color}}></div>
      </div>
    ) : (
      <div className="w-2.5 h-2.5 rounded-sm" style={{backgroundColor: color}}></div>
    )}
    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{label}</span>
  </div>
);

const HealthMetric = ({ label, percent, inverse = false }: { label: string, percent: number, inverse?: boolean }) => {
  const displayPercent = Math.min(Math.max(percent, 0), 100);
  const color = inverse 
    ? (displayPercent > 70 ? 'bg-rose-500' : 'bg-emerald-500')
    : (displayPercent > 50 ? 'bg-emerald-500' : 'bg-amber-500');

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
        <span className="text-slate-400">{label}</span>
        <span>{percent.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${displayPercent}%` }}></div>
      </div>
    </div>
  );
};

const EmptyState = ({ message, mini = false }: { message?: string, mini?: boolean }) => (
  <div className="h-full w-full flex flex-col items-center justify-center text-center p-8">
    <div className={`${mini ? 'w-10 h-10' : 'w-16 h-16'} bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 opacity-50`}>
      <BarChart3 size={mini ? 16 : 24} className="text-slate-300" />
    </div>
    {!mini && <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] max-w-[200px] leading-relaxed">{message}</p>}
  </div>
);

export default Dashboard;
