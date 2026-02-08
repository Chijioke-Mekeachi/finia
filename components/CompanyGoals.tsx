import React, { useMemo, useState } from 'react';
import { Plus, Save, Trash2, Target, TrendingUp, Archive } from 'lucide-react';
import { CompanyGoal, CompanyGoalStatus } from '../types';

type CompanyGoalsProps = {
  goals: CompanyGoal[];
  defaultUnit?: string;
  onCreateGoal: (goal: Omit<CompanyGoal, 'id'>) => Promise<void>;
  onUpdateGoal: (goalId: string, updates: Partial<CompanyGoal>) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
};

const clampPct = (value: number) => Math.max(0, Math.min(100, value));

const progressPct = (goal: Pick<CompanyGoal, 'currentValue' | 'targetValue'>) => {
  const target = Number(goal.targetValue || 0);
  if (!Number.isFinite(target) || target <= 0) return 0;
  const current = Number(goal.currentValue || 0);
  return clampPct((current / target) * 100);
};

const todayIso = () => new Date().toISOString().split('T')[0];

const CompanyGoals: React.FC<CompanyGoalsProps> = ({ goals, defaultUnit, onCreateGoal, onUpdateGoal, onDeleteGoal }) => {
  const [createLoading, setCreateLoading] = useState(false);
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<CompanyGoal>>>({});

  const [newGoal, setNewGoal] = useState<Omit<CompanyGoal, 'id'>>({
    title: '',
    description: '',
    unit: defaultUnit || '',
    targetValue: 0,
    currentValue: 0,
    startDate: todayIso(),
    dueDate: null,
    status: 'active',
  });

  const visibleGoals = useMemo(() => (goals || []).filter((g) => g.status !== 'archived'), [goals]);

  const updateDraft = (goalId: string, patch: Partial<CompanyGoal>) => {
    setDrafts((prev) => ({ ...prev, [goalId]: { ...(prev[goalId] || {}), ...patch } }));
  };

  const getMerged = (goal: CompanyGoal) => ({ ...goal, ...(drafts[goal.id] || {}) });

  const isDirty = (goal: CompanyGoal) => Boolean(drafts[goal.id] && Object.keys(drafts[goal.id] || {}).length);

  const handleCreate = async () => {
    const title = (newGoal.title || '').trim();
    const target = Number(newGoal.targetValue);
    if (!title) return alert('Please enter a goal title.');
    if (!Number.isFinite(target) || target <= 0) return alert('Target must be greater than 0.');

    setCreateLoading(true);
    try {
      await onCreateGoal({ ...newGoal, title, targetValue: target, currentValue: Number(newGoal.currentValue || 0) });
      setNewGoal({
        title: '',
        description: '',
        unit: defaultUnit || '',
        targetValue: 0,
        currentValue: 0,
        startDate: todayIso(),
        dueDate: null,
        status: 'active',
      });
    } catch (e: any) {
      alert(e?.message || 'Failed to create goal.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSave = async (goalId: string) => {
    const draft = drafts[goalId];
    if (!draft) return;

    const patch: Partial<CompanyGoal> = { ...draft };
    if (patch.title != null) patch.title = String(patch.title).trim();
    if (patch.targetValue != null) patch.targetValue = Number(patch.targetValue);
    if (patch.currentValue != null) patch.currentValue = Number(patch.currentValue);

    if (patch.title != null && !patch.title) return alert('Title cannot be empty.');
    if (patch.targetValue != null && (!Number.isFinite(patch.targetValue) || patch.targetValue <= 0)) {
      return alert('Target must be greater than 0.');
    }
    if (patch.currentValue != null && !Number.isFinite(patch.currentValue)) return alert('Current value must be a number.');

    setSavingIds((p) => ({ ...p, [goalId]: true }));
    try {
      await onUpdateGoal(goalId, patch);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[goalId];
        return next;
      });
    } catch (e: any) {
      alert(e?.message || 'Failed to save goal.');
    } finally {
      setSavingIds((p) => ({ ...p, [goalId]: false }));
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('Delete this goal? This cannot be undone.')) return;
    setDeletingIds((p) => ({ ...p, [goalId]: true }));
    try {
      await onDeleteGoal(goalId);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[goalId];
        return next;
      });
    } catch (e: any) {
      alert(e?.message || 'Failed to delete goal.');
    } finally {
      setDeletingIds((p) => ({ ...p, [goalId]: false }));
    }
  };

  const handleArchive = async (goalId: string) => {
    setSavingIds((p) => ({ ...p, [goalId]: true }));
    try {
      await onUpdateGoal(goalId, { status: 'archived' });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[goalId];
        return next;
      });
    } catch (e: any) {
      alert(e?.message || 'Failed to archive goal.');
    } finally {
      setSavingIds((p) => ({ ...p, [goalId]: false }));
    }
  };

  const statusBadge = (status: CompanyGoalStatus) => {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300';
    if (status === 'archived') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300';
  };

  return (
    <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-4 transition-colors">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
          <Target className="text-blue-600" />
          Company Goals
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Define goals, track progress, and keep them available to your AI Advisor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Goal Title</label>
            <input
              value={newGoal.title}
              onChange={(e) => setNewGoal((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
              placeholder="e.g., Increase monthly revenue"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Due Date (Optional)</label>
            <input
              type="date"
              value={newGoal.dueDate || ''}
              onChange={(e) => setNewGoal((p) => ({ ...p, dueDate: e.target.value || null }))}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Target</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={Number.isFinite(Number(newGoal.targetValue)) ? String(newGoal.targetValue) : ''}
              onChange={(e) => setNewGoal((p) => ({ ...p, targetValue: Number(e.target.value) }))}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
              placeholder="0"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unit</label>
            <input
              value={newGoal.unit || ''}
              onChange={(e) => setNewGoal((p) => ({ ...p, unit: e.target.value }))}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
              placeholder={defaultUnit || 'USD, %, units'}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description (Optional)</label>
            <textarea
              value={newGoal.description || ''}
              onChange={(e) => setNewGoal((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium resize-none"
              placeholder="Add context, constraints, or success criteria..."
            />
          </div>
        </div>

        <button
          type="button"
          disabled={createLoading}
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          {createLoading ? 'Creating...' : 'Add Goal'}
        </button>
      </div>

      <div className="space-y-4">
        {visibleGoals.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/40 p-10 rounded-[32px] border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No goals yet. Add your first goal above.</p>
          </div>
        ) : (
          visibleGoals.map((goal) => {
            const merged = getMerged(goal);
            const pct = progressPct(merged);
            const isSaving = Boolean(savingIds[goal.id]);
            const isDeleting = Boolean(deletingIds[goal.id]);
            const dirty = isDirty(goal);
            const unit = (merged.unit || '').trim();

            return (
              <div
                key={goal.id}
                className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="text-blue-600" size={18} />
                    <div>
                      <div className="flex items-center gap-3">
                        <input
                          value={merged.title}
                          onChange={(e) => updateDraft(goal.id, { title: e.target.value })}
                          className="text-lg font-black text-slate-900 dark:text-white bg-transparent outline-none border-b border-transparent focus:border-blue-500"
                        />
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusBadge(merged.status)}`}>
                          {merged.status}
                        </span>
                        {dirty && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Unsaved</span>
                        )}
                      </div>
                      {merged.dueDate ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Due: {merged.dueDate}</p>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No due date</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!dirty || isSaving || isDeleting}
                      onClick={() => handleSave(goal.id)}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || isDeleting}
                      onClick={() => handleArchive(goal.id)}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Archive size={14} />
                      Archive
                    </button>
                    <button
                      type="button"
                      disabled={isSaving || isDeleting}
                      onClick={() => handleDelete(goal.id)}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Description</label>
                    <textarea
                      rows={3}
                      value={merged.description || ''}
                      onChange={(e) => updateDraft(goal.id, { description: e.target.value })}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium resize-none"
                      placeholder="Add context, constraints, or success criteria..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Current</label>
                    <input
                      type="number"
                      step="0.01"
                      value={Number.isFinite(Number(merged.currentValue)) ? String(merged.currentValue) : ''}
                      onChange={(e) => updateDraft(goal.id, { currentValue: Number(e.target.value) })}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Target</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={Number.isFinite(Number(merged.targetValue)) ? String(merged.targetValue) : ''}
                      onChange={(e) => updateDraft(goal.id, { targetValue: Number(e.target.value) })}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Unit</label>
                    <input
                      value={merged.unit || ''}
                      onChange={(e) => updateDraft(goal.id, { unit: e.target.value })}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
                      placeholder={defaultUnit || 'USD, %, units'}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</label>
                    <select
                      value={merged.status}
                      onChange={(e) => updateDraft(goal.id, { status: e.target.value as CompanyGoalStatus })}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
                    >
                      <option value="active">active</option>
                      <option value="completed">completed</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Due Date</label>
                    <input
                      type="date"
                      value={merged.dueDate || ''}
                      onChange={(e) => updateDraft(goal.id, { dueDate: e.target.value || null })}
                      className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Progress</label>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
                      <span>
                        {merged.currentValue} {unit}
                      </span>
                      <span>
                        {merged.targetValue} {unit}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${pct.toFixed(2)}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-2">
                      {pct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CompanyGoals;

