
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, CheckCircle2, Volume2, Square, Plus, MessageSquareText } from 'lucide-react';
import { apiAi, isBackendConfigured } from '../apiClient';
import { Transaction, BusinessSettings, CompanyGoal } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../constants';
import Markdown from './Markdown';

interface AiSecretaryProps {
  transactions: Transaction[];
  settings: BusinessSettings;
  goals: CompanyGoal[];
  onAddTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isAction?: boolean;
}

type ChatListItem = {
  id: string; // "default" | "<chat_id>"
  title: string;
  created_at?: string;
  updated_at?: string;
  messages_count?: number;
  isDraft?: boolean;
};

type ChatGroup = {
  id: string;
  label: string;
  sortMs: number;
  chats: ChatListItem[];
};

const DEFAULT_GREETING = (companyName: string) =>
  `Greetings. I am your Senior Financial Strategist for ${companyName}. I have synchronized with your current ledger and am authorized to record new transactions or analyze existing ones. How can I assist with your accounting today?`;

const ADVISOR_CHAT_PREFIX = 'advisor_chat';
const ADVISOR_CHAT_ID_STORAGE = 'fintrack_advisor_chat_id';
const ADVISOR_CHAT_DRAFTS_STORAGE = 'fintrack_advisor_chat_drafts';

const buildChatPurpose = (chatId: string) => {
  const id = (chatId || '').trim() || 'default';
  return id === 'default' ? ADVISOR_CHAT_PREFIX : `${ADVISOR_CHAT_PREFIX}:${id}`;
};

const truncateTitle = (value: string, max = 48) => {
  const t = (value || '').trim().replace(/\s+/g, ' ');
  if (!t) return 'New chat';
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
};

const parseIsoDateSafe = (value?: string) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const hasTz = /[zZ]$|[+-]\d\d:\d\d$/.test(raw);
  const normalized = hasTz ? raw : `${raw}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatChatDateTime = (iso?: string) => {
  const d = parseIsoDateSafe(iso);
  if (!d) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit'
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
};

const startOfWeekSunday = (d: Date) => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
};

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);

const readDraftChats = (): ChatListItem[] => {
  try {
    const raw = localStorage.getItem(ADVISOR_CHAT_DRAFTS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.id === 'string')
      .map((c) => ({
        id: String(c.id),
        title: typeof c.title === 'string' ? c.title : 'New chat',
        created_at: typeof c.created_at === 'string' ? c.created_at : undefined,
        updated_at: typeof c.updated_at === 'string' ? c.updated_at : undefined,
        messages_count: typeof c.messages_count === 'number' ? c.messages_count : 0,
        isDraft: true,
      }));
  } catch {
    return [];
  }
};

const writeDraftChats = (drafts: ChatListItem[]) => {
  try {
    const slim = (drafts || [])
      .filter((c) => c && c.isDraft && c.id !== 'default')
      .map((c) => ({
        id: c.id,
        title: c.title,
        created_at: c.created_at,
        updated_at: c.updated_at,
        messages_count: c.messages_count ?? 0,
      }));
    localStorage.setItem(ADVISOR_CHAT_DRAFTS_STORAGE, JSON.stringify(slim));
  } catch {
    // ignore
  }
};

const ensureDefaultChat = (items: ChatListItem[]) => {
  const hasDefault = items.some((c) => c.id === 'default');
  if (hasDefault) return items;
  return [{ id: 'default', title: 'Default chat', messages_count: 0 }, ...items];
};

const mergeChatsById = (primary: ChatListItem[], secondary: ChatListItem[]) => {
  const byId = new Map<string, ChatListItem>();
  for (const c of secondary) byId.set(c.id, c);
  for (const c of primary) byId.set(c.id, { ...byId.get(c.id), ...c });
  return Array.from(byId.values());
};

const upsertChatToFront = (prev: ChatListItem[], chat: ChatListItem) => {
  const next = [chat, ...prev.filter((c) => c.id !== chat.id)];
  return ensureDefaultChat(next);
};

const stripMarkdownForTts = (text: string) => {
  // Keep this simple: remove code fences, inline code, and most markdown markers.
  return (text || '')
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[^\n]*\n?/g, '').replace(/```/g, '')) // keep code text, drop fences
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .trim();
};

const extractUserMessage = (content: string) => {
  const marker = 'USER MESSAGE:';
  const idx = content.indexOf(marker);
  if (idx === -1) return content.trim();
  let rest = content.slice(idx + marker.length).trim();
  // Trim trailing instruction blocks in older stored prompts.
  const cut = ['Return ONLY', 'Respond ONLY'].map(k => rest.indexOf(k)).filter(i => i !== -1).sort((a, b) => a - b)[0];
  if (cut != null) rest = rest.slice(0, cut).trim();
  return rest;
};

const tryExtractAssistantFromJson = (content: string) => {
  const raw = content.trim().replace(/^```[a-zA-Z]*\\s*/m, '').replace(/```\\s*$/m, '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = raw.slice(start, end + 1);
  try {
    const parsed = JSON.parse(candidate);
    if (typeof parsed?.assistant_markdown === 'string' && parsed.assistant_markdown.trim()) return parsed.assistant_markdown.trim();
    if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message.trim();
  } catch {}
  return null;
};

const hashText = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
};

const base64ToBlob = (base64: string, mimeType: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
};

const AiSecretary: React.FC<AiSecretaryProps> = ({ transactions, settings, goals, onAddTransaction }) => {
  const [activeChatId, setActiveChatId] = useState(() => sessionStorage.getItem(ADVISOR_CHAT_ID_STORAGE) || 'default');
  const activePurpose = useMemo(() => buildChatPurpose(activeChatId), [activeChatId]);

  const [chats, setChats] = useState<ChatListItem[]>(() => ensureDefaultChat(readDraftChats()));
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const groupedChats = useMemo((): ChatGroup[] => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const defaultChat = chats.find((c) => c.id === 'default') || { id: 'default', title: 'Default chat', messages_count: 0 };
    const rest = chats.filter((c) => c.id !== 'default');

    const groups = new Map<string, ChatGroup>();

    const upsertGroup = (id: string, label: string, sortMs: number) => {
      const existing = groups.get(id);
      if (existing) {
        if (sortMs > existing.sortMs) existing.sortMs = sortMs;
        return existing;
      }
      const g: ChatGroup = { id, label, sortMs, chats: [] };
      groups.set(id, g);
      return g;
    };

    const getChatSortMs = (c: ChatListItem) => {
      const d = parseIsoDateSafe(c.created_at) || parseIsoDateSafe(c.updated_at);
      return d ? d.getTime() : 0;
    };

    for (const c of rest) {
      const d = parseIsoDateSafe(c.created_at) || parseIsoDateSafe(c.updated_at);
      if (!d) {
        upsertGroup('undated', 'Undated', 0).chats.push(c);
        continue;
      }

      const sortMs = d.getTime();
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const weekStart = startOfWeekSunday(d);
        const label = `Week of ${new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' }).format(weekStart)}`;
        const id = `week:${weekStart.toISOString().slice(0, 10)}`;
        upsertGroup(id, label, weekStart.getTime()).chats.push(c);
      } else if (d.getFullYear() === currentYear) {
        const monthStart = startOfMonth(d);
        const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthStart);
        const id = `month:${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
        upsertGroup(id, label, monthStart.getTime()).chats.push(c);
      } else {
        const y = d.getFullYear();
        upsertGroup(`year:${y}`, String(y), new Date(y, 0, 1).getTime()).chats.push(c);
      }

      // Ensure the group is sorted by most-recent activity, not just its start date.
      const gKey =
        d.getFullYear() === currentYear && d.getMonth() === currentMonth
          ? `week:${startOfWeekSunday(d).toISOString().slice(0, 10)}`
          : d.getFullYear() === currentYear
            ? `month:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            : `year:${d.getFullYear()}`;
      const g = groups.get(gKey);
      if (g && sortMs > g.sortMs) g.sortMs = sortMs;
    }

    const groupsArr = Array.from(groups.values());
    for (const g of groupsArr) {
      g.chats.sort((a, b) => getChatSortMs(b) - getChatSortMs(a));
    }
    groupsArr.sort((a, b) => b.sortMs - a.sortMs);

    const pinned: ChatGroup = { id: 'pinned', label: 'Pinned', sortMs: Number.MAX_SAFE_INTEGER, chats: [defaultChat] };
    return [pinned, ...groupsArr];
  }, [chats]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesReadyRef = useRef<Promise<SpeechSynthesisVoice[]> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlCacheRef = useRef<Map<string, string>>(new Map());
  const ttsSeqRef = useRef(0);

  useEffect(() => {
    sessionStorage.setItem(ADVISOR_CHAT_ID_STORAGE, activeChatId);
  }, [activeChatId]);

  const refreshChats = async () => {
    const drafts = ensureDefaultChat(readDraftChats());
    if (!isBackendConfigured()) {
      setChats(drafts);
      return;
    }

    setLoadingChats(true);
    try {
      const rows = await apiAi.listChats(ADVISOR_CHAT_PREFIX, 50);
      const fromBackend: ChatListItem[] = (rows || []).map((r) => ({
        id: (r?.id || '').trim() || 'default',
        title: truncateTitle(r?.title || (r?.id === 'default' ? 'Default chat' : 'New chat'), 56),
        created_at: r?.created_at,
        updated_at: r?.updated_at,
        messages_count: typeof r?.messages_count === 'number' ? r.messages_count : 0,
        isDraft: false,
      }));

      const backendIds = new Set(fromBackend.map((c) => c.id));
      const remainingDrafts = drafts.filter((c) => c.isDraft && !backendIds.has(c.id));
      writeDraftChats(remainingDrafts);

      const merged = ensureDefaultChat(mergeChatsById(fromBackend, remainingDrafts));
      merged.sort((a, b) => {
        const aKey = a.updated_at || a.created_at || '';
        const bKey = b.updated_at || b.created_at || '';
        return bKey.localeCompare(aKey);
      });
      setChats(merged);
    } catch {
      setChats(drafts);
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    refreshChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load persisted chat history (backend) if available.
  useEffect(() => {
    let cancelled = false;
    setLoadingHistory(true);
    (async () => {
      try {
        if (!isBackendConfigured()) throw new Error('backend not configured');
        const rows = await apiAi.listMessages(activePurpose, 200, 0);
        if (cancelled) return;
        if (rows && rows.length > 0) {
          setMessages(
            rows
              .filter(r => r.role === 'user' || r.role === 'assistant')
              .map(r => {
                if (r.role === 'user') {
                  return { role: 'user' as const, content: extractUserMessage(r.content) };
                }
                const extracted = tryExtractAssistantFromJson(r.content);
                return { role: 'assistant' as const, content: extracted || r.content };
              })
          );
          setLoadingHistory(false);
          return;
        }
      } catch {
        // Ignore and fall back to local greeting.
      }
      if (!cancelled) {
        setMessages([
          {
            role: 'assistant',
            content: DEFAULT_GREETING(settings.companyName)
          }
        ]);
        setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings.companyName, activePurpose]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    // Cleanup: stop speech if the component unmounts.
    return () => {
      try {
        window.speechSynthesis?.cancel?.();
      } catch {
        // ignore
      }
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current = null;
        }
      } catch {
        // ignore
      }
      try {
        for (const url of audioUrlCacheRef.current.values()) URL.revokeObjectURL(url);
        audioUrlCacheRef.current.clear();
      } catch {
        // ignore
      }
    };
  }, []);

  const stopSpeech = () => {
    ttsSeqRef.current += 1;
    try {
      window.speechSynthesis?.cancel?.();
    } catch {
      // ignore
    }
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    } catch {
      // ignore
    }
    utteranceRef.current = null;
    setSpeakingIndex(null);
  };

  const ensureVoices = () => {
    if (voicesReadyRef.current) return voicesReadyRef.current;
    voicesReadyRef.current = new Promise((resolve) => {
      try {
        const synth = window.speechSynthesis;
        const initial = synth.getVoices();
        if (initial && initial.length > 0) {
          resolve(initial);
          return;
        }
        const onChanged = () => {
          const voices = synth.getVoices();
          synth.removeEventListener('voiceschanged', onChanged);
          resolve(voices || []);
        };
        synth.addEventListener('voiceschanged', onChanged);
        // Fallback: resolve after 1s even if voiceschanged never fires.
        setTimeout(() => {
          try {
            synth.removeEventListener('voiceschanged', onChanged);
          } catch {
            // ignore
          }
          resolve(synth.getVoices() || []);
        }, 1000);
      } catch {
        resolve([]);
      }
    });
    return voicesReadyRef.current;
  };

  const fallbackSpeakWithBrowser = (speechText: string, idx: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    const synth = window.speechSynthesis;
    stopSpeech();

    ensureVoices().then((voices) => {
      const u = new SpeechSynthesisUtterance(speechText);
      u.rate = 1.0;
      u.pitch = 1.0;
      u.lang = navigator.language || 'en-US';

      const langPrefix = (u.lang || 'en').split('-')[0].toLowerCase();
      const preferred =
        voices.find(v => (v.lang || '').toLowerCase().startsWith(langPrefix)) ||
        voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) ||
        voices[0];
      if (preferred) u.voice = preferred;

      u.onend = () => {
        utteranceRef.current = null;
        setSpeakingIndex(null);
      };
      u.onerror = () => {
        utteranceRef.current = null;
        setSpeakingIndex(null);
        setTtsError('Text-to-speech failed. Your browser may not have voices installed.');
      };

      utteranceRef.current = u;
      setSpeakingIndex(idx);

      try {
        synth.cancel();
        synth.speak(u);
        synth.resume();
        setTimeout(() => {
          try {
            synth.resume();
          } catch {
            // ignore
          }
        }, 50);
        if (!voices || voices.length === 0) {
          setTtsError('No voices available in this browser. Try Chrome or install a system TTS voice.');
        }
      } catch {
        setSpeakingIndex(null);
        setTtsError('Text-to-speech failed to start.');
      }
    });
  };

  const playAudioUrl = (url: string, idx: number) => {
    stopSpeech();
    setTtsError(null);

    const audio = new Audio(url);
    audioRef.current = audio;
    setSpeakingIndex(idx);

    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setSpeakingIndex(null);
      }
    };
    audio.onerror = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setSpeakingIndex(null);
        setTtsError('Audio playback failed.');
      }
    };

    audio.play().catch(() => {
      if (audioRef.current === audio) {
        audioRef.current = null;
        setSpeakingIndex(null);
      }
      setTtsError('Audio playback was blocked by the browser.');
    });
  };

  const speak = async (text: string, idx: number) => {
    const speechText = stripMarkdownForTts(text);
    if (!speechText) return;

    setTtsError(null);

    if (!isBackendConfigured()) {
      fallbackSpeakWithBrowser(speechText, idx);
      return;
    }

    const cacheKey = `${navigator.language || 'en-US'}:${hashText(speechText)}`;
    const cachedUrl = audioUrlCacheRef.current.get(cacheKey);
    if (cachedUrl) {
      playAudioUrl(cachedUrl, idx);
      return;
    }

    const seq = (ttsSeqRef.current += 1);
    setSpeakingIndex(idx);

    try {
      const response = await apiAi.tts(speechText, {
        purpose: 'advisor_tts',
        language_code: navigator.language || 'en-US',
        style: 'Speak in a calm, professional CFO tone:',
      });

      if (ttsSeqRef.current !== seq) return;

      const mimeType = response?.mime_type || 'audio/wav';
      const blob = base64ToBlob(response.audio_base64, mimeType);
      const url = URL.createObjectURL(blob);
      audioUrlCacheRef.current.set(cacheKey, url);
      playAudioUrl(url, idx);
    } catch (e: any) {
      if (ttsSeqRef.current === seq) setSpeakingIndex(null);
      // If backend TTS isn't configured/available, fall back to local browser TTS.
      fallbackSpeakWithBrowser(speechText, idx);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      if (activeChatId !== 'default') {
        // Update draft title on first message for a better chat list UX.
        setChats((prev) => {
          const next = prev.map((c) =>
            c.id === activeChatId && (c.title === 'New chat' || c.isDraft)
              ? { ...c, title: truncateTitle(userMessage, 56), updated_at: new Date().toISOString() }
              : c
          );
          const drafts = next.filter((c) => c.isDraft);
          writeDraftChats(drafts);
          return next;
        });
      }

      const prompt = `
You are a Senior CFO for ${settings.companyName}.
Current Date: ${new Date().toISOString().split('T')[0]}.
Currency: ${settings.currency}.
Company Goals (user-defined, track progress): ${JSON.stringify(
  (goals || [])
    .filter((g) => g && g.status !== 'archived')
    .slice(0, 20)
    .map((g) => ({
      title: g.title,
      description: g.description,
      unit: g.unit,
      targetValue: g.targetValue,
      currentValue: g.currentValue,
      dueDate: g.dueDate,
      status: g.status,
    }))
)}.
Available Income Categories: ${INCOME_CATEGORIES.join(', ')}.
Available Expense Categories: ${EXPENSE_CATEGORIES.join(', ')}.
Ledger Access: You have full access to the transaction history.
Current Ledger Context (Latest 50): ${JSON.stringify(transactions.slice(0, 50))}.

USER MESSAGE:
${userMessage}

Return ONLY JSON (no markdown fences) with this exact shape:
{
  "action": "recordTransaction" | "respond",
  "assistant_markdown": "string",
  "transaction": {
    "date": "YYYY-MM-DD",
    "type": "INCOME" | "EXPENSE",
    "category": "string",
    "amount": number,
    "entity": "string",
    "description": "string"
  }
}
If no transaction should be created, set action to "respond" and omit "transaction".
`;

      const response = await apiAi.analyze(prompt, undefined, activePurpose, userMessage);
      const rawText = response?.text || '';

      let parsed: any = null;
      try {
        const cleaned = rawText.trim().replace(/^```[a-zA-Z]*\\s*/m, '').replace(/```\\s*$/m, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        const candidate = start !== -1 && end !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
        parsed = JSON.parse(candidate);
      } catch (e) {
        parsed = null;
      }

      if (parsed?.action === 'recordTransaction' && parsed?.transaction) {
        const tx = parsed.transaction;
        await onAddTransaction({
          date: tx.date,
          type: tx.type,
          category: tx.category,
          amount: tx.amount,
          entity: tx.entity,
          description: tx.description || '',
        });

        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `System: Successfully recorded ${tx.type.toLowerCase()} of ${settings.currency}${tx.amount} for ${tx.entity} under ${tx.category}.`,
            isAction: true
          },
          {
            role: 'assistant',
            content: parsed.assistant_markdown || parsed.message || 'Transaction recorded.'
          }
        ]);
      } else if (parsed?.assistant_markdown) {
        setMessages(prev => [...prev, { role: 'assistant', content: parsed.assistant_markdown }]);
      } else if (parsed?.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: parsed.message }]);
      } else {
        // If model didn't follow the JSON format, just show the raw text as markdown.
        setMessages(prev => [...prev, { role: 'assistant', content: rawText || "I apologize, but I couldn't generate a financial insight for that request." }]);
      }
    } catch (error: any) {
      console.error('AI Advisory Error:', error);
      let errorMsg = "System Error: Advisory services temporarily unavailable.";
      if (error?.message) errorMsg = error.message;
      setMessages(prev => [...prev, { role: 'assistant', content: `Notice: ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
      refreshChats();
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden print:hidden animate-in zoom-in duration-300">
      <div className="hidden md:flex w-80 flex-col bg-slate-900 text-white border-r border-white/10">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquareText size={18} className="text-blue-400" />
            <span className="text-[11px] font-black uppercase tracking-widest">Chats</span>
          </div>
          <button
            type="button"
            disabled={isLoading || isClearing}
            onClick={() => {
              const makeId = () => {
                try {
                  // @ts-ignore
                  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
                } catch {}
                return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 10)}`.slice(0, 36);
              };

              const id = makeId();
              const now = new Date().toISOString();
              const draft: ChatListItem = { id, title: 'New chat', created_at: now, updated_at: now, messages_count: 0, isDraft: true };
              const currentDrafts = readDraftChats();
              writeDraftChats([draft, ...currentDrafts.filter((c) => c.id !== id)]);
              setChats((prev) => upsertChatToFront(prev, draft));
              setActiveChatId(id);
              setMessages([{ role: 'assistant', content: DEFAULT_GREETING(settings.companyName) }]);
            }}
            className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 disabled:opacity-50 inline-flex items-center gap-2"
            title="New chat"
          >
            <Plus size={14} />
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {loadingChats && (
            <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-200/80 inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} />
              Loading…
            </div>
          )}

          {groupedChats.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="px-2 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-200/70">
                {group.label}
              </div>
              {group.chats.map((c) => {
                const active = c.id === activeChatId;
                const createdDt = formatChatDateTime(c.created_at);
                const fallbackDt = createdDt || formatChatDateTime(c.updated_at);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={isLoading || isClearing}
                    onClick={() => setActiveChatId(c.id)}
                    className={`w-full text-left px-4 py-3 rounded-3xl border transition-all ${
                      active
                        ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20'
                        : 'bg-white/5 hover:bg-white/10 border-white/10'
                    } disabled:opacity-60`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black truncate">{c.id === 'default' ? 'Default chat' : (c.title || 'New chat')}</div>
                      <div className={`text-[10px] font-bold tracking-widest ${active ? 'text-blue-100/90' : 'text-slate-200/70'} flex flex-wrap gap-x-2 gap-y-1`}>
                        <span className="uppercase">
                          {(c.messages_count ?? 0) > 0 ? `${c.messages_count} msgs` : 'No messages'}
                        </span>
                        {c.isDraft && <span className="uppercase">Draft</span>}
                        {fallbackDt && <span>{createdDt ? `Created ${createdDt}` : fallbackDt}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col flex-1">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Bot size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight leading-none mb-1">CFO STRATEGIC ADVISOR</h2>
              <div className="flex items-center text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></span>
                Synchronized Ledger Active
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <select
                value={activeChatId}
                disabled={isLoading || isClearing}
                onChange={(e) => setActiveChatId(e.target.value)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 disabled:opacity-50"
                title="Select chat"
              >
                {chats.map((c) => {
                  const createdDt = formatChatDateTime(c.created_at);
                  const fallbackDt = createdDt || formatChatDateTime(c.updated_at);
                  const label = c.id === 'default' ? 'Default chat' : (c.title || 'New chat');
                  return (
                    <option key={c.id} value={c.id}>
                      {fallbackDt ? `${label} — ${fallbackDt}` : label}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              type="button"
              disabled={isLoading || isClearing}
              onClick={() => {
                const makeId = () => {
                  try {
                    // @ts-ignore
                    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
                  } catch {}
                  return `${Date.now().toString(36)}${Math.random().toString(16).slice(2, 10)}`.slice(0, 36);
                };

                const id = makeId();
                const now = new Date().toISOString();
                const draft: ChatListItem = { id, title: 'New chat', created_at: now, updated_at: now, messages_count: 0, isDraft: true };
                const currentDrafts = readDraftChats();
                writeDraftChats([draft, ...currentDrafts.filter((c) => c.id !== id)]);
                setChats((prev) => upsertChatToFront(prev, draft));
                setActiveChatId(id);
                setMessages([{ role: 'assistant', content: DEFAULT_GREETING(settings.companyName) }]);
              }}
              className="md:hidden px-4 py-2.5 bg-white/10 hover:bg-white/15 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 disabled:opacity-50 inline-flex items-center gap-2"
              title="New chat"
            >
              <Plus size={14} />
              New
            </button>

          <button
            disabled={isClearing || isLoading}
            onClick={async () => {
              setIsClearing(true);
              try {
                await apiAi.clearMessages(activePurpose);
                stopSpeech();
                try {
                  for (const url of audioUrlCacheRef.current.values()) URL.revokeObjectURL(url);
                  audioUrlCacheRef.current.clear();
                } catch {
                  // ignore
                }
                setMessages([{ role: 'assistant', content: DEFAULT_GREETING(settings.companyName) }]);
                refreshChats();
              } catch (e) {
                // keep existing
              } finally {
                setIsClearing(false);
              }
            }}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/15 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 disabled:opacity-50"
          >
            {isClearing ? 'Clearing…' : 'Clear History'}
          </button>
          <div className="hidden lg:flex items-center space-x-3 px-5 py-2.5 bg-white/10 rounded-2xl text-xs font-bold border border-white/10 backdrop-blur-sm">
            <Sparkles size={16} className="text-amber-400" />
            <span>REAL-TIME INPUT ACTIVE</span>
          </div>
        </div>
      </div>

      {ttsError && (
        <div className="px-8 py-3 bg-amber-50 text-amber-900 border-b border-amber-100 text-xs font-bold">
          {ttsError}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-10 bg-slate-50/40 dark:bg-slate-950/40 custom-scrollbar">
        {loadingHistory && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-8 py-4 rounded-3xl shadow-xl">
              <Loader2 className="animate-spin text-blue-600" size={20} />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">Loading chat…</span>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start`}>
              {!m.isAction && (
                <div className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
                  m.role === 'user' ? 'bg-slate-200 dark:bg-slate-800 ml-5' : 'bg-blue-600 text-white mr-5'
                }`}>
                  {m.role === 'user' ? <User size={22} /> : <Bot size={22} />}
                </div>
              )}
              
              {(() => {
                const assistantDisplay = m.role === 'assistant' && !m.isAction ? (tryExtractAssistantFromJson(m.content) || m.content) : m.content;
                return (
                  <div className={`p-6 rounded-[28px] text-[15px] leading-relaxed shadow-sm transition-all relative ${
                m.isAction 
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center gap-3 font-bold'
                  : m.role === 'user' 
                    ? 'bg-slate-900 dark:bg-blue-700 text-white rounded-tr-none' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-tl-none border border-slate-100 dark:border-slate-700'
              }`}>
                {m.isAction && <CheckCircle2 size={18} className="shrink-0" />}
                {m.role === 'assistant' && !m.isAction && (
                  <button
                    type="button"
                    onClick={() => (speakingIndex === i ? stopSpeech() : speak(assistantDisplay, i))}
                    className="absolute top-3 right-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title={speakingIndex === i ? 'Stop' : 'Play'}
                    aria-label={speakingIndex === i ? 'Stop speech' : 'Play speech'}
                  >
                    {speakingIndex === i ? <Square size={16} /> : <Volume2 size={16} />}
                  </button>
                )}
                {m.role === 'assistant' && !m.isAction ? (
                  <Markdown text={assistantDisplay} />
                ) : (
                  m.content
                )}
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-8 py-4 rounded-3xl shadow-xl">
              <Loader2 className="animate-spin text-blue-600" size={20} />
              <span className="text-xs text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">Processing Intelligence...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 lg:p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <form onSubmit={handleSend} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 'Record a $500 software subscription expense for AWS today'"
            className="w-full pl-5 sm:pl-8 pr-16 sm:pr-20 py-4 sm:py-6 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-[28px] focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:focus:bg-slate-800 transition-all font-medium text-base sm:text-lg placeholder:text-slate-400 dark:text-white"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-4 rounded-2xl transition-all ${
              input.trim() && !isLoading ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
            }`}
          >
            <Send size={24} />
          </button>
        </form>
        <p className="mt-3 text-[10px] text-center text-slate-400 uppercase font-black tracking-widest">
          AI can record entries, analyze burn rates, and project margins.
        </p>
      </div>
      </div>
    </div>
  );
};

export default AiSecretary;
