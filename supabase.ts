import { createClient } from '@supabase/supabase-js';

const isEmbeddedDesktop = () =>
  typeof window !== 'undefined' && (window as any).__FINTRACK_EMBEDDED__ === true;

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const supabase = (() => {
  // Desktop mode runs fully offline-first using the embedded backend.
  if (isEmbeddedDesktop()) return null;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  try {
    new URL(supabaseUrl);
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (e) {
    console.warn('Supabase initialization failed.', e);
    return null;
  }
})();

export const isSupabaseConfigured = () => Boolean(supabase);
