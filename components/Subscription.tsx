
import React, { useState, useEffect } from 'react';
import { Check, ShieldCheck, Zap, Crown, CreditCard, Loader2, Globe, RefreshCw } from 'lucide-react';
import { SubscriptionPlan, BusinessSettings } from '../types';
import { SUBSCRIPTION_PLANS } from '../constants';
import { dataService } from '../dataService';
import { isBackendConfigured } from '../apiClient';

interface SubscriptionProps {
  settings: BusinessSettings;
  currentPlanId: string;
  onUpgrade: (planId: string) => Promise<void>;
}

const Subscription: React.FC<SubscriptionProps> = ({ settings, currentPlanId, onUpgrade }) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [isFetchingRates, setIsFetchingRates] = useState(false);
  const [rateError, setRateError] = useState(false);

  const paystackEnabled =
    (import.meta.env.VITE_PAYSTACK_ENABLED as string | undefined) === '1' ||
    Boolean(import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);

  useEffect(() => {
    const fetchRates = async () => {
      if (settings.currency === 'USD') return;
      
      setIsFetchingRates(true);
      setRateError(false);
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (data && data.rates) {
          setRates(data.rates);
        } else {
          setRateError(true);
        }
      } catch (error) {
        console.error('Failed to fetch exchange rates:', error);
        setRateError(true);
      } finally {
        setIsFetchingRates(false);
      }
    };

    fetchRates();
  }, [settings.currency]);

  const handlePlanSelect = async (planId: string) => {
    if (planId === currentPlanId) return;
    setLoadingPlan(planId);
    try {
      if (paystackEnabled && isBackendConfigured()) {
        const callbackUrl = `${window.location.origin}${window.location.pathname}?view=SUBSCRIPTION&plan=${encodeURIComponent(planId)}`;
        const init = await dataService.startPaystackCheckout(planId, callbackUrl);
        if (!init?.authorization_url) throw new Error('Paystack did not return an authorization URL.');
        window.location.href = init.authorization_url;
        return;
      }

      await onUpgrade(planId);
    } finally {
      setLoadingPlan(null);
    }
  };

  const getConvertedPrice = (usdPrice: number) => {
    if (settings.currency === 'USD' || !rates[settings.currency]) {
      return usdPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    const converted = usdPrice * rates[settings.currency];
    return converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">Enterprise Scaling Plans</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          Choose the infrastructure that matches your organization's financial complexity. 
          Dynamic localized pricing based on real-time exchange rates.
        </p>
        
        {settings.currency !== 'USD' && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-500/10 rounded-full border border-blue-100 dark:border-blue-500/20">
            {isFetchingRates ? (
              <Loader2 size={12} className="animate-spin text-blue-600" />
            ) : (
              <Globe size={12} className="text-blue-600" />
            )}
            <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
              {rateError ? 'Exchange Service Offline - Using USD Base' : `Real-time conversion to ${settings.currency} active`}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {SUBSCRIPTION_PLANS.map((plan) => (
          <div 
            key={plan.id}
            className={`relative flex flex-col p-8 bg-white dark:bg-slate-900 rounded-[40px] border-2 transition-all duration-300 ${
              plan.id === currentPlanId 
                ? 'border-blue-600 shadow-2xl shadow-blue-500/10 scale-[1.02]' 
                : plan.isPopular
                  ? 'border-slate-200 dark:border-slate-800 shadow-lg'
                  : 'border-slate-100 dark:border-slate-800'
            }`}
          >
            {plan.id === currentPlanId && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                Current Active Plan
              </div>
            )}
            
            {plan.isPopular && plan.id !== currentPlanId && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                Recommended Choice
              </div>
            )}

            <div className="mb-8 flex items-center justify-between">
              <div className={`p-3 rounded-2xl ${
                plan.id === 'standard' ? 'bg-slate-100 dark:bg-slate-800 text-slate-600' :
                plan.id === 'strategic' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600' :
                'bg-amber-100 dark:bg-amber-500/10 text-amber-600'
              }`}>
                {plan.id === 'standard' && <Zap size={24} />}
                {plan.id === 'strategic' && <ShieldCheck size={24} />}
                {plan.id === 'executive' && <Crown size={24} />}
              </div>
              
              {settings.currency !== 'USD' && !rateError && !isFetchingRates && (
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                  <RefreshCw size={10} />
                  Live rate
                </div>
              )}
            </div>

            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mb-8 overflow-hidden">
              <span className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white whitespace-nowrap">
                {settings.currency} {getConvertedPrice(plan.price)}
              </span>
              <span className="text-slate-400 dark:text-slate-500 font-bold text-sm">/ mo</span>
            </div>

            <ul className="flex-1 space-y-4 mb-10">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="mt-1 bg-emerald-500/10 text-emerald-500 p-0.5 rounded-full">
                    <Check size={14} />
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handlePlanSelect(plan.id)}
              disabled={plan.id === currentPlanId || loadingPlan !== null}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
                plan.id === currentPlanId
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-default'
                  : plan.id === 'executive'
                    ? 'bg-slate-900 dark:bg-white dark:text-slate-900 text-white shadow-xl hover:opacity-90'
                    : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700'
              }`}
            >
              {loadingPlan === plan.id ? (
                <Loader2 size={18} className="animate-spin" />
              ) : plan.id === currentPlanId ? (
                'Subscribed'
              ) : (
                <>
                  <CreditCard size={18} />
                  <span>Select Plan</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 p-6 sm:p-10 rounded-[32px] border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2">
          <h4 className="text-xl font-bold text-slate-900 dark:text-white">Need a custom enterprise solution?</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-lg">
            For organizations with over 50 entities or requiring on-premise deployments, contact our institutional sales team for specialized pricing.
          </p>
        </div>
        <button className="px-6 sm:px-10 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition-all shadow-sm">
          Speak with an Expert
        </button>
      </div>
    </div>
  );
};

export default Subscription;
