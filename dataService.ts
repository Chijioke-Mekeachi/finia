import { supabase, isSupabaseConfigured } from './supabase';
import { Transaction, BusinessSettings, CompanyGoal } from './types';
import { MOCK_TRANSACTIONS } from './constants';
import { apiRequest, apiAuth, apiBilling, isBackendConfigured } from './apiClient';

const SETTINGS_KEY = 'fintrack_settings';
const TRANSACTIONS_KEY = 'fintrack_transactions';
const PROFILE_KEY = 'fintrack_profile';
const PLAN_KEY = 'fintrack_plan';
const GOALS_KEY = 'fintrack_goals';

const safeParse = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn(`Failed to parse localStorage key: ${key}`, e);
    return fallback;
  }
};

const toUiSettings = (data: any): BusinessSettings => ({
  companyName: data.company_name,
  currency: data.currency,
  fiscalYearStart: data.fiscal_year_start,
  taxRate: Number(data.tax_rate)
});

const toApiSettings = (data: BusinessSettings) => ({
  company_name: data.companyName,
  currency: data.currency,
  fiscal_year_start: data.fiscalYearStart,
  tax_rate: data.taxRate
});

const toUiGoal = (data: any): CompanyGoal => ({
  id: String(data.id),
  title: String(data.title || ''),
  description: data.description ?? null,
  unit: data.unit ?? null,
  targetValue: Number(data.target_value),
  currentValue: Number(data.current_value ?? 0),
  startDate: data.start_date ?? null,
  dueDate: data.due_date ?? null,
  status: (data.status || 'active') as any,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
});

const toApiGoalCreate = (goal: Omit<CompanyGoal, 'id'>) => ({
  title: goal.title,
  description: goal.description ?? null,
  unit: goal.unit ?? '',
  target_value: goal.targetValue,
  current_value: goal.currentValue ?? 0,
  start_date: goal.startDate ?? null,
  due_date: goal.dueDate ?? null,
  status: goal.status,
});

const toApiGoalUpdate = (goal: Partial<CompanyGoal>) => ({
  ...(goal.title !== undefined ? { title: goal.title } : {}),
  ...(goal.description !== undefined ? { description: goal.description } : {}),
  ...(goal.unit !== undefined ? { unit: goal.unit } : {}),
  ...(goal.targetValue !== undefined ? { target_value: goal.targetValue } : {}),
  ...(goal.currentValue !== undefined ? { current_value: goal.currentValue } : {}),
  ...(goal.startDate !== undefined ? { start_date: goal.startDate } : {}),
  ...(goal.dueDate !== undefined ? { due_date: goal.dueDate } : {}),
  ...(goal.status !== undefined ? { status: goal.status } : {}),
});

export const dataService = {
  // --- Profiles ---
  async getProfile(userId: string) {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      }
      if (isBackendConfigured()) {
        const me = await apiAuth.me();
        return {
          id: me.id,
          full_name: me.name,
          business_name: `${me.name}'s Organization`
        };
      }
      return safeParse(PROFILE_KEY, null);
    } catch (e: any) {
      console.error('Profile fetch failed:', e);
      return null;
    }
  },

  async updateProfile(userId: string, updates: any) {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('profiles')
          .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() });
        if (error) throw error;
        return;
      }
      if (isBackendConfigured()) {
        // No dedicated profile endpoint yet; keep local update for UI placeholders.
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ id: userId, ...updates }));
        return;
      } else {
        localStorage.setItem(PROFILE_KEY, JSON.stringify({ id: userId, ...updates }));
      }
    } catch (e: any) {
      throw new Error(e.message || 'Failed to update profile');
    }
  },

  // --- Transactions ---
  async getTransactions(userId: string): Promise<Transaction[]> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('date', { ascending: false });
        if (error) throw new Error(error.message || 'Supabase Transaction Fetch Error');
        return data || [];
      }
      if (isBackendConfigured()) {
        return apiRequest<Transaction[]>(`/api/transactions`);
      }
      
      return safeParse(TRANSACTIONS_KEY, MOCK_TRANSACTIONS);
    } catch (e: any) {
      throw new Error(e.message || 'Failed to retrieve transactions');
    }
  },

  async addTransaction(userId: string, transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('transactions')
          .insert([{ ...transaction, user_id: userId }])
          .select()
          .single();
        if (error) throw new Error(error.message || 'Supabase Transaction Insert Error');
        return data;
      }
      if (isBackendConfigured()) {
        return apiRequest<Transaction>(`/api/transactions`, {
          method: 'POST',
          body: JSON.stringify(transaction)
        });
      }

      const current = await this.getTransactions(userId);
      const newTx = { ...transaction, id: Math.random().toString(36).substr(2, 9) };
      const updated = [newTx, ...current];
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
      return newTx;
    } catch (e: any) {
      throw new Error(e.message || 'Failed to add transaction');
    }
  },

  async deleteTransaction(userId: string, id: string): Promise<void> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);
        if (error) throw new Error(error.message || 'Supabase Transaction Delete Error');
        return;
      }
      if (isBackendConfigured()) {
        await apiRequest<void>(`/api/transactions/${id}`, { method: 'DELETE' });
        return;
      }

      const current = await this.getTransactions(userId);
      const updated = current.filter(t => t.id !== id);
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
    } catch (e: any) {
      throw new Error(e.message || 'Failed to delete transaction');
    }
  },

  // --- Settings ---
  async getSettings(userId: string): Promise<BusinessSettings | null> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (error && error.code !== 'PGRST116') throw new Error(error.message || 'Supabase Settings Fetch Error');
        return data ? toUiSettings(data) : null;
      }
      if (isBackendConfigured()) {
        const data = await apiRequest<any>(`/api/settings`);
        return toUiSettings(data);
      }

      return safeParse(SETTINGS_KEY, null);
    } catch (e: any) {
      throw new Error(e.message || 'Failed to retrieve settings');
    }
  },

  async saveSettings(userId: string, settings: BusinessSettings): Promise<void> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const row = { user_id: userId, ...toApiSettings(settings) };
        const { error } = await supabase
          .from('business_settings')
          .upsert(row, { onConflict: 'user_id' });
        if (error) throw new Error(error.message || 'Supabase Settings Save Error');
        return;
      }
      if (isBackendConfigured()) {
        await apiRequest<any>(`/api/settings`, {
          method: 'POST',
          body: JSON.stringify(toApiSettings(settings))
        });
        return;
      }

      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e: any) {
      throw new Error(e.message || 'Failed to save settings');
    }
  },

  // --- Subscription Plan ---
  async getSubscriptionPlan(userId: string): Promise<string | null> {
    try {
      if (isSupabaseConfigured() && supabase) {
         // Assuming profiles table has subscription_plan_id column
         const { data, error } = await supabase
          .from('profiles')
          .select('subscription_plan_id')
          .eq('id', userId)
          .single();
        if (error && error.code !== 'PGRST116') return 'standard';
        return data?.subscription_plan_id || 'standard';
      }
      if (isBackendConfigured()) {
        const data = await apiRequest<{ plan_id: string }>(`/api/subscription`);
        return data.plan_id || 'standard';
      }
      return localStorage.getItem(PLAN_KEY) || 'standard';
    } catch (e: any) {
      return 'standard';
    }
  },

  async saveSubscriptionPlan(userId: string, planId: string): Promise<void> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('profiles')
          .update({ subscription_plan_id: planId })
          .eq('id', userId);
        if (error) throw error;
      } else if (isBackendConfigured()) {
        await apiRequest<{ plan_id: string }>(`/api/subscription`, {
          method: 'PATCH',
          body: JSON.stringify({ plan_id: planId })
        });
      } else {
        localStorage.setItem(PLAN_KEY, planId);
      }
      // Artificial delay to simulate payment processing
      await new Promise(r => setTimeout(r, 1500));
    } catch (e: any) {
      throw new Error(e.message || 'Failed to update plan');
    }
  },

  // --- Company Goals ---
  async getGoals(userId: string): Promise<CompanyGoal[]> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('company_goals')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });
        if (error) throw new Error(error.message || 'Supabase Goals Fetch Error');
        return (data || []).map((r: any) => ({
          id: String(r.id),
          title: r.title,
          description: r.description,
          unit: r.unit,
          targetValue: Number(r.target_value),
          currentValue: Number(r.current_value ?? 0),
          startDate: r.start_date,
          dueDate: r.due_date,
          status: (r.status || 'active') as any,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }
      if (isBackendConfigured()) {
        const rows = await apiRequest<any[]>(`/api/goals`);
        return (rows || []).map(toUiGoal);
      }

      return safeParse(GOALS_KEY, []);
    } catch (e: any) {
      throw new Error(e.message || 'Failed to retrieve goals');
    }
  },

  async addGoal(userId: string, goal: Omit<CompanyGoal, 'id'>): Promise<CompanyGoal> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const row = {
          user_id: userId,
          title: goal.title,
          description: goal.description ?? null,
          unit: goal.unit ?? '',
          target_value: goal.targetValue,
          current_value: goal.currentValue ?? 0,
          start_date: goal.startDate ?? null,
          due_date: goal.dueDate ?? null,
          status: goal.status,
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('company_goals').insert([row]).select().single();
        if (error) throw new Error(error.message || 'Supabase Goal Insert Error');
        return {
          id: String(data.id),
          title: data.title,
          description: data.description,
          unit: data.unit,
          targetValue: Number(data.target_value),
          currentValue: Number(data.current_value ?? 0),
          startDate: data.start_date,
          dueDate: data.due_date,
          status: (data.status || 'active') as any,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
      if (isBackendConfigured()) {
        const created = await apiRequest<any>(`/api/goals`, {
          method: 'POST',
          body: JSON.stringify(toApiGoalCreate(goal)),
        });
        return toUiGoal(created);
      }

      const current = await this.getGoals(userId);
      const now = new Date().toISOString();
      const newGoal: CompanyGoal = {
        ...goal,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: now,
        updatedAt: now,
      };
      const updated = [newGoal, ...current];
      localStorage.setItem(GOALS_KEY, JSON.stringify(updated));
      return newGoal;
    } catch (e: any) {
      throw new Error(e.message || 'Failed to add goal');
    }
  },

  async updateGoal(userId: string, goalId: string, updates: Partial<CompanyGoal>): Promise<CompanyGoal> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const patch: any = {
          ...(updates.title !== undefined ? { title: updates.title } : {}),
          ...(updates.description !== undefined ? { description: updates.description } : {}),
          ...(updates.unit !== undefined ? { unit: updates.unit } : {}),
          ...(updates.targetValue !== undefined ? { target_value: updates.targetValue } : {}),
          ...(updates.currentValue !== undefined ? { current_value: updates.currentValue } : {}),
          ...(updates.startDate !== undefined ? { start_date: updates.startDate } : {}),
          ...(updates.dueDate !== undefined ? { due_date: updates.dueDate } : {}),
          ...(updates.status !== undefined ? { status: updates.status } : {}),
          updated_at: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from('company_goals')
          .update(patch)
          .eq('id', goalId)
          .eq('user_id', userId)
          .select()
          .single();
        if (error) throw new Error(error.message || 'Supabase Goal Update Error');
        return {
          id: String(data.id),
          title: data.title,
          description: data.description,
          unit: data.unit,
          targetValue: Number(data.target_value),
          currentValue: Number(data.current_value ?? 0),
          startDate: data.start_date,
          dueDate: data.due_date,
          status: (data.status || 'active') as any,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
      }
      if (isBackendConfigured()) {
        const updated = await apiRequest<any>(`/api/goals/${encodeURIComponent(goalId)}`, {
          method: 'PATCH',
          body: JSON.stringify(toApiGoalUpdate(updates)),
        });
        return toUiGoal(updated);
      }

      const current = await this.getGoals(userId);
      const next = current.map((g) =>
        g.id === goalId ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
      );
      const updatedGoal = next.find((g) => g.id === goalId);
      if (!updatedGoal) throw new Error('Goal not found');
      localStorage.setItem(GOALS_KEY, JSON.stringify(next));
      return updatedGoal;
    } catch (e: any) {
      throw new Error(e.message || 'Failed to update goal');
    }
  },

  async deleteGoal(userId: string, goalId: string): Promise<void> {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('company_goals')
          .delete()
          .eq('id', goalId)
          .eq('user_id', userId);
        if (error) throw new Error(error.message || 'Supabase Goal Delete Error');
        return;
      }
      if (isBackendConfigured()) {
        await apiRequest<void>(`/api/goals/${encodeURIComponent(goalId)}`, { method: 'DELETE' });
        return;
      }

      const current = await this.getGoals(userId);
      const next = current.filter((g) => g.id !== goalId);
      localStorage.setItem(GOALS_KEY, JSON.stringify(next));
    } catch (e: any) {
      throw new Error(e.message || 'Failed to delete goal');
    }
  },

  // --- Billing (Paystack) ---
  async startPaystackCheckout(planId: string, callbackUrl: string) {
    if (!isBackendConfigured()) throw new Error('Backend billing is not configured.');
    return apiBilling.paystackInitialize(planId, callbackUrl);
  },

  async verifyPaystackPayment(reference: string): Promise<{ planId: string; reference: string }> {
    if (!isBackendConfigured()) throw new Error('Backend billing is not configured.');
    const res = await apiBilling.paystackVerify(reference);
    const planId = (res?.plan_id || '').trim();
    if (!planId) throw new Error('Verification succeeded but plan_id missing.');
    return { planId, reference: res.reference };
  },
};
