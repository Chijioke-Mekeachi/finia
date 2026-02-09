import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, ShieldCheck, Loader2, History, RotateCcw } from 'lucide-react';
import { API_BASE_URL, getAuthToken, isBackendConfigured } from '../apiClient';

type RowCell = { col: number; col_letter: string; header: string; value: string };
type AuditDiff = {
  file1: string;
  file2: string;
  sheet?: string;
  row?: number;
  col?: number;
  col_letter?: string;
  col_header?: string | null;
  row_header?: string | null;
  file1_value?: string;
  file2_value?: string;
  file1_row?: RowCell[];
  file2_row?: RowCell[];
  row_truncated?: boolean;
};
type ScanSummary = {
  id: string;
  file1_name: string;
  file2_name: string;
  differences_count: number;
  status: string;
  error?: string | null;
  created_at: string;
};

const RowContext: React.FC<{
  label: string;
  badgeClassName: string;
  rowCells: RowCell[] | undefined;
  highlightCol?: number;
}> = ({ label, badgeClassName, rowCells, highlightCol }) => {
  if (!rowCells || rowCells.length === 0) {
    return <div className="text-xs text-slate-500 dark:text-slate-400">Row context unavailable.</div>;
  }

  return (
    <div className="space-y-2">
      <div className={`inline-flex items-center px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${badgeClassName}`}>
        {label}
      </div>
      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-2xl">
        <table className="min-w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/40">
            <tr>
              {rowCells.map((c) => (
                <th
                  key={c.col}
                  className={`px-3 py-2 text-left text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
                    c.col === highlightCol ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {rowCells.map((c) => (
                <td
                  key={c.col}
                  className={`px-3 py-3 align-top text-xs font-mono whitespace-nowrap ${
                    c.col === highlightCol
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-slate-900 dark:text-white'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {c.value || <span className="text-slate-400">(empty)</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Auditing: React.FC = () => {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<AuditDiff[]>([]);
  const [scanId, setScanId] = useState<string | null>(null);
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const canSubmit = Boolean(file1 && file2 && !loading);

  const summary = useMemo(() => {
    if (loading) return 'Comparing workbooks...';
    if (error) return error;
    if (!file1 || !file2) return 'Upload two Excel files to begin.';
    if (!diffs.length) return 'Ready to compare.';
    return `${diffs.length.toLocaleString()} difference${diffs.length === 1 ? '' : 's'} found.`;
  }, [diffs.length, error, file1, file2, loading]);

  const loadHistory = async () => {
    if (!isBackendConfigured()) return;
    setHistoryLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/audit/scans?limit=25`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!res.ok) throw new Error(`Failed to load scan history (${res.status})`);
      const data = (await res.json()) as ScanSummary[];
      setScans(Array.isArray(data) ? data : []);
    } catch (e) {
      // Keep UI usable even if history fails
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file1 || !file2) return;
    if (!isBackendConfigured()) {
      setError('Backend not configured (set VITE_API_URL to enable Excel auditing).');
      return;
    }

    setLoading(true);
    setError(null);
    setDiffs([]);
    setScanId(null);
    setExpanded({});

    const form = new FormData();
    form.append('file1', file1);
    form.append('file2', file2);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/audit/compare-excel/v2`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form
      });

      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const data = await res.json();
          const detail = data?.detail || data?.message;
          if (typeof detail === 'string') msg = detail;
        } catch (_) {}
        throw new Error(msg);
      }

      const data = (await res.json()) as any;
      if (!data || typeof data !== 'object' || !Array.isArray(data.diffs)) {
        throw new Error('Unexpected response format');
      }
      setScanId(typeof data.scan_id === 'string' ? data.scan_id : null);
      setDiffs(data.diffs as AuditDiff[]);
      loadHistory();
    } catch (err: any) {
      setError(err?.message || 'Compare failed');
    } finally {
      setLoading(false);
    }
  };

  const loadScan = async (id: string) => {
    if (!isBackendConfigured()) return;
    setLoading(true);
    setError(null);
    setDiffs([]);
    setScanId(id);
    setExpanded({});
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/api/audit/scans/${encodeURIComponent(id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      if (!res.ok) throw new Error(`Failed to load scan (${res.status})`);
      const data = (await res.json()) as any;
      if (!data || typeof data !== 'object' || !Array.isArray(data.diffs)) {
        throw new Error('Unexpected response format');
      }
      setDiffs(data.diffs as AuditDiff[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load scan');
    } finally {
      setLoading(false);
    }
  };

  const newScan = () => {
    setError(null);
    setDiffs([]);
    setScanId(null);
    setFile1(null);
    setFile2(null);
    setExpanded({});
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-start justify-between gap-6 flex-col lg:flex-row">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
              Audit Mode
            </span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Excel Auditing
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Upload two Excel workbooks and compare them cell-by-cell. Each detected change is shown as a section with File 1 on top and File 2 below. If headers exist, they are included in the location label.
          </p>
        </div>

        <form onSubmit={submit} className="w-full lg:max-w-xl">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 space-y-6 shadow-sm">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                File 1
              </label>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <FileSpreadsheet size={18} />
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.xltx,.xltm"
                  onChange={(ev) => setFile1(ev.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-slate-900 file:text-white hover:file:opacity-90"
                />
              </div>
              {file1 && <div className="text-xs text-slate-400 truncate">{file1.name}</div>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                File 2
              </label>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <FileSpreadsheet size={18} />
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xlsm,.xltx,.xltm"
                  onChange={(ev) => setFile2(ev.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-slate-900 file:text-white hover:file:opacity-90"
                />
              </div>
              {file2 && <div className="text-xs text-slate-400 truncate">{file2.name}</div>}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={newScan}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
              >
                <RotateCcw size={14} />
                New Scan
              </button>
              {scanId && (
                <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                  Scan: {scanId}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 ${
                canSubmit
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Comparing</span>
                </>
              ) : (
                'Compare Files'
              )}
            </button>

            <div className={`text-xs ${error ? 'text-rose-600' : 'text-slate-500 dark:text-slate-400'}`}>
              {summary}
            </div>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <History size={16} className="text-slate-500 dark:text-slate-400" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                  Scan History
                </h3>
              </div>
              <button
                type="button"
                onClick={loadHistory}
                disabled={historyLoading}
                className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline disabled:opacity-50"
              >
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs font-medium">Loading history...</span>
              </div>
            ) : scans.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">No scans yet.</div>
            ) : (
              <div className="space-y-3">
                {scans.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadScan(s.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      scanId === s.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {s.file1_name} vs {s.file2_name}
                      </div>
                      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">
                        {s.differences_count}
                      </div>
                    </div>
                    <div className="mt-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {new Date(s.created_at).toLocaleString()}
                      {s.status !== 'succeeded' ? ` • ${s.status}` : ''}
                    </div>
                    {s.error && (
                      <div className="mt-2 text-xs text-rose-600 truncate">{s.error}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {diffs.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Differences</h3>
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {diffs.length.toLocaleString()} change{diffs.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-4">
                {diffs.map((d, idx) => {
                  const isOpen = Boolean(expanded[idx]);
                  const location = d.sheet
                    ? `${d.sheet} • ${d.col_letter || d.col || ''}, ${d.row || ''}`.trim()
                    : `${d.col_letter || d.col || ''}, ${d.row || ''}`.trim();
                  const headerTextParts = [
                    d.col_header ? `Column: ${d.col_header}` : null,
                    d.row_header ? `Row: ${d.row_header}` : null
                  ].filter(Boolean);

                  return (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-6 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        className="w-full text-left"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                Change #{idx + 1}
                              </div>
                              {location && (
                                <div className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                  {location}
                                </div>
                              )}
                            </div>
                            {headerTextParts.length > 0 && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {headerTextParts.join(' • ')}
                              </div>
                            )}
                          </div>
                          <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                            {isOpen ? 'Hide Row' : 'Show Row'}
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 inline-flex items-center px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
                              File 1
                            </div>
                            <div className="font-mono text-sm text-slate-900 dark:text-white whitespace-pre-wrap break-words">
                              {d.file1_value != null ? d.file1_value : d.file1}
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 inline-flex items-center px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                              File 2
                            </div>
                            <div className="font-mono text-sm text-slate-900 dark:text-white whitespace-pre-wrap break-words">
                              {d.file2_value != null ? d.file2_value : d.file2}
                            </div>
                          </div>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="mt-6 space-y-6">
                          {d.row_truncated && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Row is truncated for display (increase `AUDIT_ROW_CONTEXT_MAX_COLS` on the backend to include more columns).
                            </div>
                          )}
                          <RowContext
                            label="Row (File 1)"
                            badgeClassName="bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-400"
                            rowCells={d.file1_row}
                            highlightCol={d.col}
                          />
                          <RowContext
                            label="Row (File 2)"
                            badgeClassName="bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400"
                            rowCells={d.file2_row}
                            highlightCol={d.col}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Auditing;
