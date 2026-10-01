import { useState } from 'react';
import { BookmarkPlus, Trash2, Wand2, Loader2 } from 'lucide-react';
import type { Preset } from '../lib/api';
import { formatKb } from '../lib/imageTools';

interface Props {
  presets: Preset[];
  loading: boolean;
  onApply: (p: Preset) => void;
  onSave: (name: string) => void;
  onDelete: (id: number) => void;
  saving: boolean;
}

export default function PresetsPanel({ presets, loading, onApply, onSave, onDelete, saving }: Props) {
  const [name, setName] = useState('');
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
      <h3 className="flex items-center gap-2 font-bold text-white mb-1"><Wand2 className="h-4 w-4 text-fuchsia-400" />Cloud presets</h3>
      <p className="text-xs text-white/50 mb-4">Saved in your database — reuse one-click recipes for passports, web uploads, WhatsApp & more.</p>
      <div className="flex gap-2 mb-4">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setName(''); } }} placeholder="Preset name — e.g. Passport 300KB" className="flex-1 min-w-0 rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-fuchsia-400" />
        <button disabled={saving || !name.trim()} onClick={() => { onSave(name.trim()); setName(''); }} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />} Save
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-6 text-white/50 text-sm"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading presets…</div>
      ) : presets.length === 0 ? (
        <p className="rounded-xl bg-black/30 px-4 py-5 text-center text-sm text-white/40">No presets yet — adjust settings above, then save your first recipe.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {presets.map((p) => (
            <div key={p.id} className="rounded-xl border border-white/10 bg-black/30 p-3 hover:border-fuchsia-400/40 transition cursor-pointer" onClick={() => onApply(p)}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-white truncate">{p.name}</p>
                <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }} className="rounded-md p-1 text-white/35 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              <p className="mt-1 text-[11px] text-white/50">
                {p.target_size_kb ? `Target ${formatKb(Number(p.target_size_kb))}` : `Q${p.quality}`} • {p.format.split('/')[1].toUpperCase()} • {p.max_width ? `${p.max_width}px` : 'Original size'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
