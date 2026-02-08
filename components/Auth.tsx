
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Briefcase, Mail, Lock, User, ArrowRight, Loader2, 
  AlertCircle, ArrowLeft, CheckCircle2, Shield, 
  Globe, Zap, Fingerprint, Building, MapPin, DollarSign, Bot, Eye, EyeOff
} from 'lucide-react';

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT' | 'RESET';

interface CountryData {
  name: string;
  cca2: string;
  currency: string;
  flag: string;
}

const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [direction, setDirection] = useState<'left' | 'right' | 'none'>('none');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New Country/Currency state
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState('US');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [isFetchingGeo, setIsFetchingGeo] = useState(false);

  const { login, signup, sendPasswordReset, updatePassword } = useAuth();

  const isEmbeddedDesktop = () => (window as any).__FINTRACK_EMBEDDED__ === true;

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setMode('RESET');
    }

    // Fetch countries list and auto-detect location
    const initializeGeoData = async () => {
      if (isEmbeddedDesktop()) {
        // Offline-safe minimal set for desktop embedded mode.
        const minimal: CountryData[] = [
          { name: 'United States', cca2: 'US', currency: 'USD', flag: '🇺🇸' },
          { name: 'United Kingdom', cca2: 'GB', currency: 'GBP', flag: '🇬🇧' },
          { name: 'Canada', cca2: 'CA', currency: 'CAD', flag: '🇨🇦' },
          { name: 'Germany', cca2: 'DE', currency: 'EUR', flag: '🇩🇪' },
          { name: 'Nigeria', cca2: 'NG', currency: 'NGN', flag: '🇳🇬' },
        ];
        setCountries(minimal);
        setSelectedCountryCode('US');
        setSelectedCurrency('USD');
        return;
      }

      setIsFetchingGeo(true);
      try {
        // 1. Fetch full countries list
        const res = await fetch('https://restcountries.com/v3.1/all?fields=name,currencies,cca2,flag');
        const data = await res.json();
        const mappedCountries: CountryData[] = data.map((c: any) => ({
          name: c.name.common,
          cca2: c.cca2,
          currency: Object.keys(c.currencies || {})[0] || 'USD',
          flag: c.flag
        })).sort((a: CountryData, b: CountryData) => a.name.localeCompare(b.name));
        
        setCountries(mappedCountries);

        // 2. Auto-detect user location
        const ipRes = await fetch('https://ipapi.co/json/');
        const ipData = await ipRes.json();
        
        if (ipData.country_code) {
          setSelectedCountryCode(ipData.country_code);
          setSelectedCurrency(ipData.currency || 'USD');
        }
      } catch (err) {
        console.error('Failed to fetch geo data:', err);
      } finally {
        setIsFetchingGeo(false);
      }
    };

    initializeGeoData();
  }, []);

  useEffect(() => {
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [mode]);

  const handleCountryChange = (cca2: string) => {
    const country = countries.find(c => c.cca2 === cca2);
    if (country) {
      setSelectedCountryCode(cca2);
      setSelectedCurrency(country.currency);
    }
  };

  const changeMode = (newMode: AuthMode) => {
    if (mode === newMode) return;
    if (mode === 'LOGIN' && newMode === 'REGISTER') setDirection('right');
    else if (mode === 'REGISTER' && newMode === 'LOGIN') setDirection('left');
    else setDirection('none');
    
    setMode(newMode);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (mode === 'LOGIN') {
        await login(email, password);
      } else if (mode === 'REGISTER') {
        await signup(email, name, selectedCurrency, password);
      } else if (mode === 'FORGOT') {
        const res: any = await sendPasswordReset(email);
        // In local dev, backend may return a token when DEBUG_RESET_TOKENS=1.
        // If present, we can move the user directly into the RESET flow.
        if (res?.token) {
          window.location.hash = `token=${encodeURIComponent(res.token)}`;
          setSuccess(`Reset token generated (dev): ${res.token}`);
          changeMode('RESET');
        } else {
          setSuccess(res?.message || 'Verification link dispatched.');
        }
      } else if (mode === 'RESET') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        await updatePassword(password);
        setSuccess('Password updated.');
        changeMode('LOGIN');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAnimClass = () => {
    if (direction === 'right') return 'animate-slide-in-right';
    if (direction === 'left') return 'animate-slide-in-left';
    return 'animate-scale-up';
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex transition-colors duration-500 overflow-hidden font-sans">
      
      {/* --- Left Panel: Brand & Marketing --- */}
      <div className="hidden lg:flex w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center p-12">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
        
        <div className="relative z-10 w-full max-w-lg">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-blue-400 text-[10px] font-black tracking-widest uppercase mb-12 backdrop-blur-md">
            <Shield size={14} />
            Enterprise Financial Layer v2.6
          </div>
          
          <h1 className="text-6xl font-black text-white tracking-tighter leading-tight mb-8">
            Manage capital with <span className="text-blue-500">absolute precision.</span>
          </h1>
          
          <div className="space-y-8">
            <FeatureItem 
              icon={<Zap className="text-blue-400" size={20} />}
              title="Real-time Ledger Analysis"
              desc="AI-driven insights that calculate your burn rate and margins instantly."
            />
            <FeatureItem 
              icon={<Globe className="text-indigo-400" size={20} />}
              title="Global Compliance"
              desc="Multi-currency support for enterprises operating across borders."
            />
            <FeatureItem 
              icon={<Bot className="text-emerald-400" size={20} />}
              title="AI Strategic Advisor"
              desc="Harness high-tier generative intelligence to analyze margins and audit burn rates."
            />
          </div>

          <div className="mt-20 pt-12 border-t border-white/10 flex items-center gap-8">
            <div className="flex -space-x-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-sm font-medium">Joined by <span className="text-white font-bold">1,200+</span> global enterprises this month.</p>
          </div>
        </div>
      </div>

      {/* --- Right Panel: Form --- */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 md:p-20 relative overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-3">
              {mode === 'LOGIN' ? 'Welcome Back' : mode === 'REGISTER' ? 'Create Account' : 'Security Reset'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Access your global financial dashboard and AI assets.
            </p>
          </div>

          {mode !== 'FORGOT' && mode !== 'RESET' && (
            <div className="relative flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl mb-10">
              <div 
                className="absolute top-1 bottom-1 left-1 bg-white dark:bg-slate-700 rounded-xl shadow-sm transition-transform duration-300 ease-in-out"
                style={{ 
                  width: 'calc(50% - 4px)',
                  transform: `translateX(${mode === 'REGISTER' ? '100%' : '0%'})`
                }}
              />
              <button onClick={() => changeMode('LOGIN')} className={`relative flex-1 py-3 text-xs font-black uppercase tracking-widest z-10 transition-colors ${mode === 'LOGIN' ? 'text-blue-600 dark:text-white' : 'text-slate-500'}`}>Sign In</button>
              <button onClick={() => changeMode('REGISTER')} className={`relative flex-1 py-3 text-xs font-black uppercase tracking-widest z-10 transition-colors ${mode === 'REGISTER' ? 'text-blue-600 dark:text-white' : 'text-slate-500'}`}>Register</button>
            </div>
          )}

          <div key={mode} className={getAnimClass()}>
            {error && (
              <div className="mb-8 p-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-xs font-bold animate-in slide-in-from-top-2">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {mode === 'REGISTER' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Full Identity</label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white font-semibold"
                        placeholder="Organization Representative"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Organization Base</label>
                      <div className="relative group">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select
                          value={selectedCountryCode}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-slate-900 dark:text-white font-semibold text-sm appearance-none"
                        >
                          {countries.map(c => (
                            <option key={c.cca2} value={c.cca2}>{c.flag} {c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Reporting Currency</label>
                      <div className="relative group">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          readOnly
                          value={selectedCurrency}
                          className="w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 font-black tracking-widest text-sm cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {(mode !== 'RESET') && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Corporate Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white font-semibold"
                      placeholder="admin@enterprise.com"
                    />
                  </div>
                </div>
              )}

              {(mode !== 'FORGOT') && (
                <div className="space-y-2">
                  <div className="flex justify-between items-end px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{mode === 'RESET' ? 'New Security Key' : 'Password'}</label>
                    {mode === 'LOGIN' && (
                      <button type="button" onClick={() => setMode('FORGOT')} className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest">
                        Forgot Key?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white font-semibold"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'RESET' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Verify Security Key</label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={20} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all text-slate-900 dark:text-white font-semibold"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isFetchingGeo}
                className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-3 overflow-hidden"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <span>
                      {mode === 'LOGIN' ? 'Access Infrastructure' : 
                       mode === 'REGISTER' ? 'Register Profile' : 
                       mode === 'FORGOT' ? 'Recover Access' : 'Update Security'}
                    </span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {mode === 'LOGIN' && (
              <div className="mt-8">
                <div className="relative flex items-center justify-center mb-8">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100 dark:border-slate-800"></div></div>
                  <span className="relative bg-white dark:bg-slate-950 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">or continue with</span>
                </div>
                
                <button type="button" className="w-full flex items-center justify-center gap-3 py-4 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-bold text-slate-700 dark:text-slate-300">
                  <Building size={18} />
                  <span>Enterprise SSO</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureItem = ({ icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex gap-5 animate-in slide-in-from-left-4 duration-700">
    <div className="mt-1 p-3 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm shadow-xl shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  </div>
);

export default Auth;
