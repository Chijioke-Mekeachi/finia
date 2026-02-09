import React, { useEffect, useMemo, useState } from 'react';
import { apiAdmin, API_BASE_URL } from '../apiClient';
import { Loader2, Shield, Users, RefreshCcw, Search, ArrowLeftRight, Download, ArrowLeft } from 'lucide-react';

type AdminUserSummary = {
  id: string;
  email: string;
  name: string;
  subscription_plan_id: string;
  created_at: string;
  dummy_password: string;
  transactions_count: number;
  settings?: {
    company_name: string;
    currency: string;
    fiscal_year_start: string;
    tax_rate: number;
  } | null;
};

type AdminUserDetail = AdminUserSummary & {
  transactions: Array<{
    id: string;
    date: string;
    type: 'INCOME' | 'EXPENSE' | string;
    category: string;
    amount: number;
    description?: string | null;
    entity: string;
  }>;
};

const ADMIN_KEY_STORAGE = 'fintrack_admin_key';

const Admin: React.FC = () => {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE) || '');
  const [adminKeyDraft, setAdminKeyDraft] = useState(adminKey);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<'USERS' | 'TRANSACTIONS'>('USERS');

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [query, setQuery] = useState('');

  const [txRows, setTxRows] = useState<any[]>([]);
  const [txFrom, setTxFrom] = useState<string>('');
  const [txTo, setTxTo] = useState<string>('');
  const [txType, setTxType] = useState<string>('');
  const [txQuery, setTxQuery] = useState<string>('');

  const [aiModels, setAiModels] = useState<any | null>(null);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q));
  }, [users, query]);

  const loadUsers = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiAdmin.listUsers(key);
      setUsers(data);
    } catch (e: any) {
      setUsers([]);
      setSelectedUserId(null);
      setSelectedUser(null);
      setError(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetail = async (key: string, userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiAdmin.getUser(key, userId, 200, 0);
      setSelectedUser(data);
    } catch (e: any) {
      setSelectedUser(null);
      setError(e?.message || 'Failed to load user detail');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!adminKey) return;
    loadUsers(adminKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!adminKey || !selectedUserId) return;
    loadUserDetail(adminKey, selectedUserId);
  }, [adminKey, selectedUserId]);

  const loadTransactions = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiAdmin.listTransactions(key, {
        from_date: txFrom || undefined,
        to_date: txTo || undefined,
        type: txType || undefined,
        q: txQuery || undefined,
        limit: 500,
        offset: 0
      });
      setTxRows(rows || []);
    } catch (e: any) {
      setTxRows([]);
      setError(e?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const exportTransactionsCsv = async () => {
    if (!adminKey) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (txFrom) qs.set('from_date', txFrom);
      if (txTo) qs.set('to_date', txTo);
      if (txType) qs.set('type', txType);
      if (txQuery) qs.set('q', txQuery);
      qs.set('limit', '5000');
      qs.set('offset', '0');
      qs.set('format', 'csv');

      const res = await fetch(`${API_BASE_URL}/admin/transactions?${qs.toString()}`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fintrack_admin_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || 'CSV export failed');
    } finally {
      setLoading(false);
    }
  };

  const loadAiModels = async (key: string, version?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiAdmin.listAiModels(key, version);
      setAiModels(data);
    } catch (e: any) {
      setAiModels(null);
      setError(e?.message || 'Failed to load AI models');
    } finally {
      setLoading(false);
    }
  };

  const saveKey = () => {
    const next = adminKeyDraft.trim();
    setAdminKey(next);
    sessionStorage.setItem(ADMIN_KEY_STORAGE, next);
    if (next) loadUsers(next);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[40px] shadow-2xl overflow-hidden">
        <div className="p-6 sm:p-10 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-blue-600 text-white flex items-center justify-center shadow-lg">
              <Shield size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Admin Console</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Dev-only user overview. Passwords are never shown; a dummy value is displayed.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <a
              href="/"
              className="px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} />
              Back
            </a>
            <input
              value={adminKeyDraft}
              onChange={(e) => setAdminKeyDraft(e.target.value)}
              placeholder="X-Admin-Key (from backend/.env)"
              className="flex-1 lg:w-[380px] px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10"
            />
            <button
              onClick={saveKey}
              className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all"
            >
              Connect
            </button>
            <button
              onClick={() => {
                if (!adminKey) return;
                if (tab === 'USERS') loadUsers(adminKey);
                else loadTransactions(adminKey);
              }}
              disabled={!adminKey || loading}
              className="px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 inline-flex items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              Refresh
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-bold">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <button
              onClick={() => setTab('USERS')}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                tab === 'USERS'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setTab('TRANSACTIONS')}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all inline-flex items-center justify-center gap-2 ${
                tab === 'TRANSACTIONS'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-blue-600 dark:border-blue-600'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <ArrowLeftRight size={14} />
              Transactions
            </button>
          </div>

          <div className="mb-10 border border-slate-100 dark:border-slate-800 rounded-[32px] p-6 bg-slate-50 dark:bg-slate-900">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Model Check</div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">
                  If AI requests fail with NOT_FOUND, use this to see which models your key supports.
                </div>
                {aiModels?.env_model && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-2">
                    Backend `GEMINI_MODEL`: <span className="font-mono">{aiModels.env_model}</span> • API version: <span className="font-mono">{aiModels.api_version}</span>
                  </div>
                )}
                {aiModels?.suggested_model && (
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 font-black mt-2">
                    Suggested: <span className="font-mono">{aiModels.suggested_model}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => adminKey && loadAiModels(adminKey)}
                  disabled={!adminKey || loading}
                  className="px-5 py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all disabled:opacity-50"
                >
                  Check Models (v1beta)
                </button>
                <button
                  onClick={() => adminKey && loadAiModels(adminKey, 'v1')}
                  disabled={!adminKey || loading}
                  className="px-5 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  Check Models (v1)
                </button>
              </div>
            </div>

            {aiModels?.models && Array.isArray(aiModels.models) && aiModels.models.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiModels.models.slice(0, 12).map((m: any) => (
                  <div key={m.name} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-black text-slate-900 dark:text-white font-mono truncate">{m.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
                      {m.displayName || 'Model'} • {Array.isArray(m.methods) ? m.methods.join(', ') : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {tab === 'USERS' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-xs">
                    <Users size={16} />
                    <span>{filteredUsers.length} users</span>
                  </div>
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search email or name"
                      className="pl-10 pr-4 py-3 w-full sm:w-[300px] bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>

	                <div className="border border-slate-100 dark:border-slate-800 rounded-[32px] overflow-x-auto">
	                  <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[920px]">
	                    <div className="col-span-4 px-6 py-4">Email</div>
	                    <div className="col-span-3 px-6 py-4">Name</div>
	                    <div className="col-span-2 px-6 py-4">Plan</div>
	                    <div className="col-span-2 px-6 py-4">Password</div>
	                    <div className="col-span-1 px-6 py-4 text-right">Tx</div>
	                  </div>
	
	                  <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[520px] overflow-y-auto custom-scrollbar min-w-[920px]">
	                    {filteredUsers.map((u) => (
	                      <button
	                        key={u.id}
	                        onClick={() => setSelectedUserId(u.id)}
	                        className={`w-full grid grid-cols-12 text-left px-0 py-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${selectedUserId === u.id ? 'bg-blue-50/60 dark:bg-blue-500/10' : ''} min-w-[920px]`}
	                      >
                        <div className="col-span-4 px-6 py-4">
                          <div className="text-sm font-black text-slate-900 dark:text-white truncate">{u.email}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{new Date(u.created_at).toLocaleString()}</div>
                        </div>
                        <div className="col-span-3 px-6 py-4">
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{u.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{u.settings?.company_name || 'No settings'}</div>
                        </div>
                        <div className="col-span-2 px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">{u.subscription_plan_id}</span>
                        </div>
                        <div className="col-span-2 px-6 py-4">
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-300">{u.dummy_password || '********'}</span>
                        </div>
                        <div className="col-span-1 px-6 py-4 text-right">
                          <span className="text-sm font-black text-slate-900 dark:text-white">{u.transactions_count}</span>
                        </div>
                      </button>
                    ))}

                    {!loading && filteredUsers.length === 0 && (
                      <div className="p-6 sm:p-10 text-center text-slate-500 dark:text-slate-400 font-bold">
                        No users found.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border border-slate-100 dark:border-slate-800 rounded-[32px] p-8 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Selected User</div>

                  {!selectedUser && (
                    <div className="text-sm text-slate-500 dark:text-slate-400 font-bold">Select a user to view details.</div>
                  )}

                  {selectedUser && (
                    <div className="space-y-6">
                      <div>
                        <div className="text-sm font-black text-slate-900 dark:text-white">{selectedUser.email}</div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">{selectedUser.name}</div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan</div>
                          <div className="text-sm font-black text-slate-900 dark:text-white">{selectedUser.subscription_plan_id}</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</div>
                          <div className="text-sm font-mono font-black text-slate-900 dark:text-white">{selectedUser.dummy_password || '********'}</div>
                        </div>
                      </div>

                      <div className="p-5 rounded-3xl bg-slate-950 text-slate-200">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Business Settings</div>
                        <div className="mt-3 text-sm font-bold">
                          {selectedUser.settings?.company_name || 'No settings'}
                        </div>
                        <div className="mt-1 text-xs text-slate-400 font-bold">
                          {selectedUser.settings ? `${selectedUser.settings.currency} • ${selectedUser.settings.fiscal_year_start} • Tax ${selectedUser.settings.tax_rate}%` : ''}
                        </div>
                      </div>

                      <div className="border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden">
                        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Latest Transactions ({selectedUser.transactions?.length || 0})
                        </div>
                        <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800 custom-scrollbar">
                          {(selectedUser.transactions || []).slice(0, 50).map((t) => (
                            <div key={t.id} className="px-5 py-4">
                              <div className="flex items-center justify-between">
                                <div className="text-sm font-black text-slate-900 dark:text-white truncate">{t.entity}</div>
                                <div className={`text-sm font-black ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                  {t.type === 'INCOME' ? '+' : '-'}{Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t.date} • {t.category}</div>
                              {t.description && <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-2">{t.description}</div>}
                            </div>
                          ))}

                          {(!selectedUser.transactions || selectedUser.transactions.length === 0) && (
                            <div className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400 font-bold">No transactions.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                  Security note: this page intentionally does not show real passwords or password hashes.
                </div>
              </div>
            </div>
          )}

          {tab === 'TRANSACTIONS' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">From</label>
                  <input
                    type="date"
                    value={txFrom}
                    onChange={(e) => setTxFrom(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">To</label>
                  <input
                    type="date"
                    value={txTo}
                    onChange={(e) => setTxTo(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">Type</label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">All</option>
                    <option value="INCOME">INCOME</option>
                    <option value="EXPENSE">EXPENSE</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2">Search</label>
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={txQuery}
                      onChange={(e) => setTxQuery(e.target.value)}
                      placeholder="Email, name, entity, category"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => adminKey && loadTransactions(adminKey)}
                  disabled={!adminKey || loading}
                  className="px-6 py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? 'Loading…' : 'Apply Filters'}
                </button>
                <button
                  onClick={exportTransactionsCsv}
                  disabled={!adminKey || loading}
                  className="px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>

	              <div className="border border-slate-100 dark:border-slate-800 rounded-[32px] overflow-x-auto">
	                <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[980px]">
	                  <div className="col-span-2 px-6 py-4">Date</div>
	                  <div className="col-span-3 px-6 py-4">User</div>
	                  <div className="col-span-3 px-6 py-4">Entity</div>
	                  <div className="col-span-2 px-6 py-4">Category</div>
	                  <div className="col-span-1 px-6 py-4">Type</div>
	                  <div className="col-span-1 px-6 py-4 text-right">Amount</div>
	                </div>
	                <div className="divide-y divide-slate-50 dark:divide-slate-800 max-h-[620px] overflow-y-auto custom-scrollbar min-w-[980px]">
	                  {txRows.map((t: any) => (
	                    <button
	                      key={t.id}
                      onClick={() => {
                        setTab('USERS');
                        setSelectedUserId(t.user_id);
                      }}
	                      className="w-full grid grid-cols-12 text-left hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors min-w-[980px]"
	                      title="Click to open user details"
	                    >
                      <div className="col-span-2 px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200">{String(t.date)}</div>
                      <div className="col-span-3 px-6 py-4">
                        <div className="text-sm font-black text-slate-900 dark:text-white truncate">{t.user_email}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t.user_name} • {t.user_plan_id}</div>
                      </div>
                      <div className="col-span-3 px-6 py-4">
                        <div className="text-sm font-black text-slate-900 dark:text-white truncate">{t.entity}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t.id}</div>
                      </div>
                      <div className="col-span-2 px-6 py-4 text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{t.category}</div>
                      <div className="col-span-1 px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          t.type === 'INCOME' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
                        }`}>{t.type}</span>
                      </div>
                      <div className={`col-span-1 px-6 py-4 text-right text-sm font-black ${t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                        {t.type === 'INCOME' ? '+' : '-'}{Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </button>
                  ))}

                  {!loading && txRows.length === 0 && (
                    <div className="p-6 sm:p-10 text-center text-slate-500 dark:text-slate-400 font-bold">
                      No transactions found. Click “Apply Filters”.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
