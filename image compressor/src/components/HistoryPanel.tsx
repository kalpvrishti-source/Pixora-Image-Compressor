import { History, Trash2, Loader2 } from 'lucide-react';
import type { Job } from '../lib/api';
import { formatKb } from '../lib/imageTools';

interface Props {
  jobs: Job[];
  loading: boolean;
  onClear: () => void;
}

export default function HistoryPanel({ jobs, loading, onClear }: Props) {
  const totalSaved = jobs.reduce((a, j) => a + Math.max(0, (Number(j.original_size_kb) || 0) - (Number(j.compressed_size_kb) || 0)), 0);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
      <div className="flex items-center justify-between mb-1">
        <h3 className="flex items-center gap-2 font-bold text-white"><History className="h-4 w-4 text-fuchsia-400" />Compression history</h3>
        {jobs.length > 0 && <button onClick={onClear} className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white/70 hover:bg-white/20"><Trash2 className="h-3 w-3" />Clear</button>}
      </div>
      <p className="text-xs text-white/50 mb-4">{jobs.length > 0 ? <>{jobs.length} files compressed • <span className="text-emerald-300 font-bold">{formatKb(totalSaved)} saved</span> in total</> : 'Every compression is logged here automatically.'}</p>
      {loading ? (
        <div className="flex items-center justify-center py-6 text-white/50 text-sm"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading history…</div>
      ) : jobs.length === 0 ? (
        <p className="rounded-xl bg-black/30 px-4 py-5 text-center text-sm text-white/40">Nothing here yet — compress your first photo and it will appear.</p>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
          {jobs.map((j) => {
            const pct = Number(j.original_size_kb) > 0 ? Math.max(0, Math.round((1 - Number(j.compressed_size_kb) / Number(j.original_size_kb)) * 100)) : 0;
            return (
              <div key={j.id} className="flex items-center gap-3 rounded-xl bg-black/30 px-3.5 py-2.5 text-xs border border-white/5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-white/90">{j.file_name}</p>
                  <p className="text-white/40">{new Date(j.created_at).toLocaleString()} • {j.format.split('/')[1]?.toUpperCase()} {j.width ? `• ${j.width}×${j.height}` : ''}</p>
                </div>
                <span className="text-white/40 whitespace-nowrap hidden sm:inline">{formatKb(Number(j.original_size_kb))} → <b className="text-emerald-300">{formatKb(Number(j.compressed_size_kb))}</b></span>
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-300 whitespace-nowrap">−{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
