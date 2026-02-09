
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  BarChart3, 
  Bot, 
  Settings as SettingsIcon,
  Download,
  FileText,
  DollarSign,
  Menu,
  X,
  ShieldCheck,
  Briefcase,
  Target,
  Sun,
  Moon,
  LogOut,
  Loader2,
  CreditCard,
  Users
} from 'lucide-react';
import { AppView, Transaction, BusinessSettings, CompanyGoal } from './types';
import { MOCK_TRANSACTIONS } from './constants';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import BalanceSheet from './components/BalanceSheet';
import Auditing from './components/Auditing';
import AiSecretary from './components/AiSecretary';
import FinancialReport from './components/FinancialReport';
import Subscription from './components/Subscription';
import Settings from './components/Settings';
import CompanyGoals from './components/CompanyGoals';
import Auth from './components/Auth';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { dataService } from './dataService';

const DEFAULT_SETTINGS: BusinessSettings = {
  companyName: 'Enterprise Holdings',
  currency: 'USD',
  fiscalYearStart: 'January',
  taxRate: 15
};

const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading, logout } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<BusinessSettings>(DEFAULT_SETTINGS);
  const [currentPlan, setCurrentPlan] = useState<string>('standard');
  const [goals, setGoals] = useState<CompanyGoal[]>([]);

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setDataLoading(true);
        try {
          const [fetchedTx, fetchedSettings, fetchedPlan, fetchedGoals] = await Promise.all([
            dataService.getTransactions(user.id),
            dataService.getSettings(user.id),
            dataService.getSubscriptionPlan(user.id),
            dataService.getGoals(user.id),
          ]);
          setTransactions(fetchedTx);
          if (fetchedSettings) setSettings(fetchedSettings);
          if (fetchedPlan) setCurrentPlan(fetchedPlan);
          if (fetchedGoals) setGoals(fetchedGoals);
        } catch (e) {
          console.error('Data Sync Error:', e);
        } finally {
          setDataLoading(false);
        }
      }
    };
    loadData();
  }, [user]);

  // Handle Paystack redirect callbacks (verify and update plan)
  useEffect(() => {
    if (!user) return;

    const qs = new URLSearchParams(window.location.search);
    const view = (qs.get('view') || '').trim().toUpperCase();
    const ref =
      (qs.get('reference') || '').trim() ||
      (qs.get('trxref') || '').trim() ||
      (qs.get('paystack_reference') || '').trim();

    if (view === 'SUBSCRIPTION') setCurrentView(AppView.SUBSCRIPTION);
    if (!ref) return;

    (async () => {
      try {
        setDataLoading(true);
        setCurrentView(AppView.SUBSCRIPTION);
        const verified = await dataService.verifyPaystackPayment(ref);
        setCurrentPlan(verified.planId);
        alert('Payment verified. Subscription updated.');
      } catch (e: any) {
        alert(e?.message || 'Payment verification failed.');
      } finally {
        setDataLoading(false);
        try {
          const next = new URL(window.location.href);
          next.searchParams.delete('reference');
          next.searchParams.delete('trxref');
          next.searchParams.delete('paystack_reference');
          next.searchParams.delete('view');
          next.searchParams.delete('plan');
          window.history.replaceState({}, '', next.toString());
        } catch {}
      }
    })();
  }, [user]);

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Initializing FinTrack Engine...</p>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const handleAddTransaction = async (t: Omit<Transaction, 'id'>) => {
    try {
      const newTx = await dataService.addTransaction(user.id, t);
      setTransactions(prev => [newTx, ...prev]);
    } catch (e) {
      alert('Failed to record transaction. Connection issues.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await dataService.deleteTransaction(user.id, id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      alert('Could not delete transaction.');
    }
  };

  const handleUpdateSettings = async (s: BusinessSettings) => {
    try {
      await dataService.saveSettings(user.id, s);
      setSettings(s);
    } catch (e) {
      alert('Failed to update business settings.');
    }
  };

  const handleUpgradePlan = async (planId: string) => {
    try {
      await dataService.saveSubscriptionPlan(user.id, planId);
      setCurrentPlan(planId);
      alert('Subscription plan updated successfully.');
    } catch (e) {
      alert('Failed to update subscription.');
    }
  };

  const handleResetData = async () => {
    setTransactions([]);
  };

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const exportData = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify({ transactions, settings, currentPlan, goals }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `fintrack_export_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const NavItem = ({
    view,
    icon: Icon,
    label,
    expanded,
  }: {
    view: AppView;
    icon: any;
    label: string;
    expanded?: boolean;
  }) => (
    <button
      onClick={() => {
        setCurrentView(view);
        setMobileNavOpen(false);
      }}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        currentView === view 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <Icon size={20} />
      {(expanded ?? isSidebarOpen) && <span className="font-semibold text-sm">{label}</span>}
    </button>
  );

  const handleCreateGoal = async (goal: Omit<CompanyGoal, 'id'>) => {
    if (!user) return;
    const created = await dataService.addGoal(user.id, goal);
    setGoals((prev) => [created, ...prev]);
  };

  const handleUpdateGoal = async (goalId: string, updates: Partial<CompanyGoal>) => {
    if (!user) return;
    const updated = await dataService.updateGoal(user.id, goalId, updates);
    setGoals((prev) => prev.map((g) => (g.id === goalId ? updated : g)));
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!user) return;
    await dataService.deleteGoal(user.id, goalId);
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  };

  return (
    <div className="flex h-screen bg-[#FDFDFF] dark:bg-slate-950 transition-colors duration-300 overflow-hidden">
      {/* Mobile sidebar drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col print:hidden shadow-2xl">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center space-x-3 text-blue-700">
                <div className="bg-blue-700 p-2 rounded-lg text-white">
                  <Briefcase size={20} />
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                  FINTRACK<span className="text-blue-600">PRO</span>
                </span>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-4">
                Operations
              </p>
              <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="Dashboard" expanded />
              <NavItem view={AppView.TRANSACTIONS} icon={ArrowLeftRight} label="Cash Flow" expanded />

              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4">
                Auditing
              </p>
              <NavItem view={AppView.AUDITING} icon={ShieldCheck} label="Excel Audit" expanded />
              <NavItem view={AppView.BALANCE_SHEET} icon={BarChart3} label="Balance Sheet" expanded />
              <NavItem view={AppView.REPORTS} icon={FileText} label="Monthly Reports" expanded />

              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4">
                Intelligence
              </p>
              <NavItem view={AppView.GOALS} icon={Target} label="Goals" expanded />
              <NavItem view={AppView.AI_SECRETARY} icon={Bot} label="AI Advisor" expanded />

              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4">
                Billing
              </p>
              <NavItem view={AppView.SUBSCRIPTION} icon={CreditCard} label="Plan & Subscription" expanded />

              {import.meta.env.DEV && (
                <>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4">
                    Administration
                  </p>
                  <a
                    href="/admin"
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <Users size={20} />
                    <span className="font-semibold text-sm">Admin Console</span>
                  </a>
                </>
              )}
            </nav>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <NavItem view={AppView.SETTINGS} icon={SettingsIcon} label="Settings" expanded />
              <button
                onClick={() => {
                  exportData();
                  setMobileNavOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Download size={20} />
                <span className="font-semibold text-sm">Offline Export</span>
              </button>
              <button
                onClick={() => {
                  logout();
                  setMobileNavOpen(false);
                }}
                className="w-full flex items-center space-x-3 px-4 py-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
              >
                <LogOut size={20} />
                <span className="font-semibold text-sm">End Session</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-24'} hidden lg:flex bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex-col z-20 print:hidden`}>
        <div className="p-8 flex items-center justify-between">
          <div className={`flex items-center space-x-3 text-blue-700 ${!isSidebarOpen && 'hidden'}`}>
            <div className="bg-blue-700 p-2 rounded-lg text-white">
              <Briefcase size={20} />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">FINTRACK<span className="text-blue-600">PRO</span></span>
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto">
          <p className={`text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-4 ${!isSidebarOpen && 'hidden'}`}>Operations</p>
          <NavItem view={AppView.DASHBOARD} icon={LayoutDashboard} label="Dashboard" />
          <NavItem view={AppView.TRANSACTIONS} icon={ArrowLeftRight} label="Cash Flow" />
          
          <p className={`text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4 ${!isSidebarOpen && 'hidden'}`}>Auditing</p>
          <NavItem view={AppView.AUDITING} icon={ShieldCheck} label="Excel Audit" />
          <NavItem view={AppView.BALANCE_SHEET} icon={BarChart3} label="Balance Sheet" />
          <NavItem view={AppView.REPORTS} icon={FileText} label="Monthly Reports" />
          
          <p className={`text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4 ${!isSidebarOpen && 'hidden'}`}>Intelligence</p>
          <NavItem view={AppView.GOALS} icon={Target} label="Goals" />
          <NavItem view={AppView.AI_SECRETARY} icon={Bot} label="AI Advisor" />

          <p className={`text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4 ${!isSidebarOpen && 'hidden'}`}>Billing</p>
          <NavItem view={AppView.SUBSCRIPTION} icon={CreditCard} label="Plan & Subscription" />

          {import.meta.env.DEV && (
            <>
              <p className={`text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4 ${!isSidebarOpen && 'hidden'}`}>Administration</p>
              <a
                href="/admin"
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              >
                <Users size={20} />
                {isSidebarOpen && <span className="font-semibold text-sm">Admin Console</span>}
              </a>
            </>
          )}
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <NavItem view={AppView.SETTINGS} icon={SettingsIcon} label="Settings" />
          <button onClick={exportData} className="w-full flex items-center space-x-3 px-4 py-3 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            <Download size={20} />
            {isSidebarOpen && <span className="font-semibold text-sm">Offline Export</span>}
          </button>
          <button onClick={logout} className="w-full flex items-center space-x-3 px-4 py-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all">
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-semibold text-sm">End Session</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 lg:px-10 print:hidden sticky top-0 z-10 transition-colors">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500 dark:text-slate-300"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-0.5">{settings.companyName}</h2>
              <h1 className="text-xl font-black text-slate-900 dark:text-white capitalize tracking-tight">{currentView.replace('_', ' ').toLowerCase()}</h1>
            </div>
            {dataLoading && <Loader2 className="animate-spin text-blue-500" size={16} />}
          </div>
          <div className="flex items-center space-x-6">
             <div className="hidden lg:flex flex-col items-end mr-2">
               <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Current Plan</span>
               <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">{currentPlan}</span>
             </div>
             <button 
               onClick={toggleTheme}
               className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
             >
               {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
             </button>

             <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
             <div className="flex items-center space-x-3 group cursor-pointer">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-none mb-1">{user.name}</p>
                  <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{user.email}</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-blue-600 flex items-center justify-center text-white font-black">
                  {user.name.charAt(0)}
                </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 bg-[#FDFDFF] dark:bg-slate-950 transition-colors scroll-smooth custom-scrollbar">
          {currentView === AppView.DASHBOARD && <Dashboard transactions={transactions} settings={settings} />}
          {currentView === AppView.TRANSACTIONS && (
            <TransactionList 
              transactions={transactions} 
              onAdd={handleAddTransaction} 
              onDelete={handleDeleteTransaction}
              settings={settings}
            />
          )}
          {currentView === AppView.GOALS && (
            <CompanyGoals
              goals={goals}
              defaultUnit={settings.currency}
              onCreateGoal={handleCreateGoal}
              onUpdateGoal={handleUpdateGoal}
              onDeleteGoal={handleDeleteGoal}
            />
          )}
          {currentView === AppView.BALANCE_SHEET && <BalanceSheet transactions={transactions} settings={settings} />}
          {currentView === AppView.AUDITING && <Auditing />}
          {currentView === AppView.REPORTS && <FinancialReport transactions={transactions} settings={settings} />}
          {currentView === AppView.AI_SECRETARY && <AiSecretary transactions={transactions} settings={settings} goals={goals} onAddTransaction={handleAddTransaction} />}
          {currentView === AppView.SUBSCRIPTION && <Subscription settings={settings} currentPlanId={currentPlan} onUpgrade={handleUpgradePlan} />}
          {currentView === AppView.SETTINGS && <Settings settings={settings} onUpdate={handleUpdateSettings} onReset={handleResetData} />}
        </div>
      </main>
    </div>
  );
};

export default App;
