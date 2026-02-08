import { supabase, isSupabaseConfigured } from './supabase';

const DEFAULT_API_URL = 'http://localhost:3001';
const ENV_API_URL = import.meta.env.VITE_API_URL as string | undefined;
const RUNTIME_API_URL =
  typeof window !== 'undefined' ? ((window as any).__FINTRACK_API_URL__ as string | undefined) : undefined;
const HAS_RUNTIME_API_URL = typeof RUNTIME_API_URL === 'string';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const chosenBaseUrl = HAS_RUNTIME_API_URL ? (RUNTIME_API_URL as string) : (ENV_API_URL || DEFAULT_API_URL);
export const API_BASE_URL = normalizeBaseUrl(chosenBaseUrl);
// Backend is optional. Only enable if explicitly configured.
export const isBackendConfigured = () => HAS_RUNTIME_API_URL || Boolean((ENV_API_URL || '').trim());

const TOKEN_KEY = 'fintrack_token';

export const authStore = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data.session?.access_token || null;
    }
  } catch {}
  return authStore.getToken();
};

const buildError = async (res: Response) => {
  try {
    const data = await res.json();
    const detail = data?.detail || data?.message;
    if (Array.isArray(detail)) {
      // FastAPI validation errors (422) look like: [{loc: [...], msg: "...", type: "..."}]
      const msg = detail
        .map((e: any) => {
          const loc = Array.isArray(e?.loc) ? e.loc.filter((p: any) => p !== 'body').join('.') : 'field';
          return `${loc}: ${e?.msg || 'invalid'}`;
        })
        .join('; ');
      return new Error(msg || `Request failed (${res.status})`);
    }
    return new Error((typeof detail === 'string' ? detail : null) || `Request failed (${res.status})`);
  } catch (e) {
    return new Error(`Request failed (${res.status})`);
  }
};

type RequestOptions = RequestInit & { auth?: boolean };

export const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false) {
    const token = await getAuthToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) throw await buildError(res);

  if (res.status === 204) return null as T;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return (await res.text()) as unknown as T;
};

export const apiAuth = {
  async login(email: string, password: string) {
    const token = await apiRequest<{ access_token: string }>(`/auth/login`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password })
    });
    authStore.setToken(token.access_token);
    return apiRequest<{ id: string; email: string; name: string; subscription_plan_id: string }>(`/auth/me`);
  },

  async signup(email: string, name: string, currency: string, password: string) {
    const token = await apiRequest<{ access_token: string }>(`/auth/signup`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, name, currency, password })
    });
    authStore.setToken(token.access_token);
    return apiRequest<{ id: string; email: string; name: string; subscription_plan_id: string }>(`/auth/me`);
  },

  async me() {
    return apiRequest<{ id: string; email: string; name: string; subscription_plan_id: string }>(`/auth/me`);
  },

  async requestPasswordReset(email: string) {
    return apiRequest<{ message: string; token?: string }>(`/auth/reset-password`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email })
    });
  },

  async confirmPasswordReset(token: string, newPassword: string) {
    return apiRequest<{ message: string }>(`/auth/reset-password/confirm`, {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ token, new_password: newPassword })
    });
  },

  async updatePassword(newPassword: string) {
    return apiRequest<{ message: string }>(`/auth/update-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword })
    });
  }
};

export const apiAi = {
  async analyze(prompt: string, model?: string, purpose?: string, userMessage?: string) {
    return apiRequest<{ text: string }>(`/api/ai/analyze`, {
      method: 'POST',
      body: JSON.stringify({ prompt, model, purpose, user_message: userMessage })
    });
  },
  async listChats(prefix = 'advisor_chat', limit = 50) {
    const qs = new URLSearchParams();
    if (prefix) qs.set('prefix', prefix);
    qs.set('limit', String(limit));
    return apiRequest<Array<{ id: string; purpose: string; title: string; created_at: string; updated_at: string; messages_count: number }>>(
      `/api/ai/chats?${qs.toString()}`
    );
  },
  async tts(
    text: string,
    opts: {
      model?: string;
      voice_name?: string;
      language_code?: string;
      purpose?: string;
      style?: string;
    } = {}
  ) {
    return apiRequest<{ audio_base64: string; mime_type: string; sample_rate_hz: number }>(`/api/ai/tts`, {
      method: 'POST',
      body: JSON.stringify({ text, ...opts })
    });
  },
  async vision(prompt: string, imageBase64: string, mimeType?: string, model?: string, purpose?: string, userMessage?: string) {
    return apiRequest<{ text: string }>(`/api/ai/vision`, {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        image_base64: imageBase64,
        mime_type: mimeType || 'image/jpeg',
        model,
        purpose,
        user_message: userMessage
      })
    });
  },
  async listMessages(purpose?: string, limit = 100, offset = 0) {
    const qs = new URLSearchParams();
    if (purpose) qs.set('purpose', purpose);
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    return apiRequest<Array<{ id: string; role: string; purpose: string; content: string; created_at: string }>>(
      `/api/ai/messages?${qs.toString()}`
    );
  },
  async clearMessages(purpose?: string) {
    const qs = new URLSearchParams();
    if (purpose) qs.set('purpose', purpose);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest<void>(`/api/ai/messages${suffix}`, { method: 'DELETE' });
  }
};

export const apiAdmin = {
  async listUsers(adminKey: string, limit = 200, offset = 0) {
    return apiRequest<any[]>(`/admin/users?limit=${limit}&offset=${offset}`, {
      auth: false,
      headers: { 'X-Admin-Key': adminKey }
    });
  },
  async getUser(adminKey: string, userId: string, limit = 200, offset = 0) {
    return apiRequest<any>(`/admin/users/${encodeURIComponent(userId)}?limit=${limit}&offset=${offset}`, {
      auth: false,
      headers: { 'X-Admin-Key': adminKey }
    });
  },
  async listTransactions(
    adminKey: string,
    params: { from_date?: string; to_date?: string; type?: string; q?: string; limit?: number; offset?: number } = {}
  ) {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set('from_date', params.from_date);
    if (params.to_date) qs.set('to_date', params.to_date);
    if (params.type) qs.set('type', params.type);
    if (params.q) qs.set('q', params.q);
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const query = qs.toString();
    return apiRequest<any[]>(`/admin/transactions${query ? `?${query}` : ''}`, {
      auth: false,
      headers: { 'X-Admin-Key': adminKey }
    });
  },
  async listAiModels(adminKey: string, version?: string) {
    const qs = version ? `?version=${encodeURIComponent(version)}` : '';
    return apiRequest<any>(`/admin/ai/models${qs}`, {
      auth: false,
      headers: { 'X-Admin-Key': adminKey }
    });
  }
};

export const apiBilling = {
  async paystackInitialize(planId: string, callbackUrl?: string) {
    return apiRequest<{ authorization_url: string; access_code: string; reference: string }>(`/api/billing/paystack/initialize`, {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, callback_url: callbackUrl })
    });
  },
  async paystackVerify(reference: string) {
    const qs = new URLSearchParams();
    qs.set('reference', reference);
    return apiRequest<{ status: 'succeeded' | 'failed'; plan_id?: string | null; reference: string }>(
      `/api/billing/paystack/verify?${qs.toString()}`
    );
  }
};
