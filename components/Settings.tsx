
import React from 'react';
import { BusinessSettings } from '../types';
import { Save, RefreshCcw, Building2, Globe, Calendar, Percent, AlertTriangle } from 'lucide-react';

interface SettingsProps {
  settings: BusinessSettings;
  onUpdate: (s: BusinessSettings) => void;
  onReset: () => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate, onReset }) => {
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [showConfirm, setShowConfirm] = React.useState(false);

  const handleSave = () => {
    onUpdate(localSettings);
    alert('Settings updated.');
  };

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 transition-colors">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
        <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <Building2 className="text-blue-600" />
          Company Profile
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Business Name</label>
            <input 
              type="text" 
              value={localSettings.companyName}
              onChange={e => setLocalSettings({...localSettings, companyName: e.target.value})}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Currency</label>
            <select 
              value={localSettings.currency}
              onChange={e => setLocalSettings({...localSettings, currency: e.target.value})}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
            >
              <option value="USD">USD - United States Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95"
        >
          Apply Changes
        </button>
      </div>

      <div className="bg-rose-50 dark:bg-rose-950/20 p-8 rounded-[32px] border border-rose-100 dark:border-rose-900/40 space-y-4">
        <h3 className="text-xl font-black text-rose-900 dark:text-rose-400 flex items-center gap-3">
          <AlertTriangle />
          Danger Zone
        </h3>
        <p className="text-sm text-rose-700 dark:text-rose-400/70 font-medium">Resetting the ledger will permanently delete all history.</p>
        
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all">
            Reset Ledger
          </button>
        ) : (
          <div className="flex items-center gap-4 animate-in zoom-in duration-200">
             <button onClick={() => { onReset(); setShowConfirm(false); }} className="px-6 py-3 bg-rose-900 text-white rounded-xl font-black">CONFIRM DELETE</button>
             <button onClick={() => setShowConfirm(false)} className="px-6 py-3 bg-white dark:bg-slate-800 text-rose-900 dark:text-white rounded-xl font-bold">Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
