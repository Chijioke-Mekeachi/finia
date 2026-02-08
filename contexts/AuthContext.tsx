import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';
import { dataService } from '../dataService';
import { apiAuth, authStore, isBackendConfigured } from '../apiClient';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  signup: (email: string, name: string, currency: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ message?: string; token?: string } | void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getResetTokenFromLocation = () => {
  const searchToken = new URLSearchParams(window.location.search).get('token');
  if (searchToken) return searchToken;

  const hash = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  return hashParams.get('token');
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (isSupabaseConfigured() && supabase) {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.full_name || 'Member'
            });
          }

          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
              setUser({
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.full_name || 'Member'
              });
            } else {
              setUser(null);
            }
          });

          return () => subscription.unsubscribe();
        } else {
          if (isBackendConfigured()) {
            const token = authStore.getToken();
            if (token) {
              const me = await apiAuth.me();
              setUser({ id: me.id, email: me.email, name: me.name });
            }
            return;
          }
          const saved = localStorage.getItem('fintrack_user');
          if (saved) {
            try {
              setUser(JSON.parse(saved));
            } catch (e) {
              localStorage.removeItem('fintrack_user');
            }
          }
        }
      } catch (e) {
        console.error('Authentication Initialization Error:', e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password?: string) => {
    try {
      if (isSupabaseConfigured() && supabase && password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return;
      }

      if (isBackendConfigured()) {
        if (!password) throw new Error('Password is required.');
        const me = await apiAuth.login(email, password);
        setUser({ id: me.id, email: me.email, name: me.name });
      } else {
        const mockUser = { id: 'mock-uuid', email, name: 'Enterprise Member' };
        setUser(mockUser);
        localStorage.setItem('fintrack_user', JSON.stringify(mockUser));
      }
    } catch (err: any) {
      throw new Error(err.message || 'Login failed');
    }
  };

  const signup = async (email: string, name: string, currency: string, password?: string) => {
    try {
      let newUser: User;
      const usedSupabase = Boolean(isSupabaseConfigured() && supabase && password);

      if (usedSupabase && supabase && password) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              company_name: `${name}'s Organization`,
              currency,
              fiscal_year_start: 'January',
              tax_rate: 0,
            },
          },
        });
        if (error) throw error;
        if (!data.user) throw new Error('Signup failed: No user returned');
        newUser = { id: data.user.id, email: data.user.email || '', name: name };
      } else if (isBackendConfigured()) {
        if (!password) throw new Error('Password is required.');
        const me = await apiAuth.signup(email, name, currency, password);
        newUser = { id: me.id, email: me.email, name: me.name };
      } else {
        newUser = { id: 'mock-uuid', email, name };
      }

      // Avoid writing app tables until the user has an authenticated session (RLS).
      // For Supabase signups, bootstrap rows are created by the DB trigger from user_metadata.
      if (!usedSupabase) {
        await dataService.saveSettings(newUser.id, {
          companyName: `${name}'s Organization`,
          currency: currency,
          fiscalYearStart: 'January',
          taxRate: 0,
        });
      }

      if (isBackendConfigured()) {
        setUser(newUser);
      } else if (!(isSupabaseConfigured() && supabase)) {
        setUser(newUser);
        localStorage.setItem('fintrack_user', JSON.stringify(newUser));
      }
    } catch (err: any) {
      throw new Error(err.message || 'Signup failed');
    }
  };

  const sendPasswordReset = async (email: string) => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        return { message: 'Reset email sent.' };
      } else if (isBackendConfigured()) {
        return await apiAuth.requestPasswordReset(email);
      } else {
        console.log('Mock: Password reset email sent to', email);
        return { message: 'Mock reset initiated.' };
      }
    } catch (err: any) {
      throw new Error(err.message || 'Reset request failed');
    }
  };

  const updatePassword = async (password: string) => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        return;
      }

      if (isBackendConfigured()) {
        if (user) {
          await apiAuth.updatePassword(password);
          return;
        }
        const token = getResetTokenFromLocation();
        if (!token) throw new Error('Reset token missing.');
        await apiAuth.confirmPasswordReset(token, password);
        return;
      } else {
        console.log('Mock: Password updated locally');
      }
    } catch (err: any) {
      throw new Error(err.message || 'Password update failed');
    }
  };

  const logout = async () => {
    try {
      if (isBackendConfigured()) {
        authStore.clearToken();
      }

      if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error('Logout error:', e);
    }
    setUser(null);
    localStorage.removeItem('fintrack_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, sendPasswordReset, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
