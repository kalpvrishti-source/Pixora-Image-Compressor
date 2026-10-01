import { Crosshair, SlidersHorizontal, ImageDown } from 'lucide-react';
import type { CompressOptions } from '../lib/imageTools';

interface Props {
  value: CompressOptions;
  onChange: (v: CompressOptions) => void;
  onApplyAll: () => void;
  count: number;
}

export default function GlobalSettings({ value, onChange, onApplyAll, count }: Props) {
  const set = (p: Partial<CompressOptions>) => onChange({ ...value, ...p });
  const targetMode = value.targetSizeKb != null && value.targetSizeKb > 0;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-bold text-white"><SlidersHorizontal className="h-4 w-4 text-fuchsia-400" />Compression settings</h3>
        <button onClick={onApplyAll} disabled={count === 0} className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-40">Apply to all {count > 0 ? `(${count})` : ''}</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-black/30 p-3.5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70"><Crosshair className="h-3.5 w-3.5 text-fuchsia-400" />Target size</span>
            <button onClick={() => set({ targetSizeKb: targetMode ? null : 300 })} className={`relative h-5 w-9 rounded-full transition ${targetMode ? 'bg-fuchsia-500' : 'bg-white/20'}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${targetMode ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
          {targetMode ? (
            <div className="flex items-center gap-2">
              <input type="number" min={10} max={20000} value={value.targetSizeKb ?? 300} onChange={(e) => set({ targetSizeKb: Math.max(10, parseInt(e.target.value) || 10) })} className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-fuchsia-400" />
              <span className="text-xs text-white/50 shrink-0">KB</span>
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-[11px] text-white/50 mb-1"><span>Quality</span><span className="font-bold text-white">{value.quality}%</span></div>
              <input type="range" min={5} max={95} value={value.quality} onChange={(e) => set({ quality: parseInt(e.target.value) })} className="w-full accent-fuchsia-500" />
            </div>
          )}
          <div className="mt-2 flex gap-1.5">
            {[100, 300, 500, 1024].map((kb) => (
              <button key={kb} onClick={() => set({ targetSizeKb: kb })} className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition ${value.targetSizeKb === kb ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>{kb >= 1024 ? '1MB' : `${kb}K`}</button>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-black/30 p-3.5 border border-white/10">
          <p className="text-xs font-semibold text-white/70 mb-2">Max dimensions</p>
          <div className="flex items-center gap-2">
            <input type="number" placeholder="W" value={value.maxWidth ?? ''} onChange={(e) => set({ maxWidth: e.target.value ? parseInt(e.target.value) : null })} className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-fuchsia-400" />
            <span className="text-white/30">×</span>
            <input type="number" placeholder="H" value={value.maxHeight ?? ''} onChange={(e) => set({ maxHeight: e.target.value ? parseInt(e.target.value) : null })} className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-fuchsia-400" />
          </div>
          <div className="mt-2 flex gap-1.5">
            {[['HD', 1280], ['2K', 2048], ['4K', 3840]].map(([label, v]) => (
              <button key={label as string} onClick={() => set({ maxWidth: v as number, maxHeight: v as number })} className="flex-1 rounded-lg bg-white/10 py-1 text-[10px] font-bold text-white/60 hover:bg-white/20">{label}</button>
            ))}
            <button onClick={() => set({ maxWidth: null, maxHeight: null })} className="flex-1 rounded-lg bg-white/10 py-1 text-[10px] font-bold text-white/60 hover:bg-white/20">Orig</button>
          </div>
        </div>
        <div className="rounded-xl bg-black/30 p-3.5 border border-white/10">
          <p className="text-xs font-semibold text-white/70 mb-2 flex items-center gap-1.5"><ImageDown className="h-3.5 w-3.5 text-fuchsia-400" />Output format</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[['JPG', 'image/jpeg'], ['PNG', 'image/png'], ['WebP', 'image/webp']].map(([label, mime]) => (
              <button key={mime} onClick={() => set({ format: mime })} className={`rounded-lg py-2 text-xs font-bold transition ${value.format === mime ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>{label}</button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-white/40">WebP = smallest size, JPG = universal, PNG = lossless</p>
        </div>
        <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/15 to-indigo-500/15 p-3.5">
          <p className="text-xs font-semibold text-white/80 mb-1">How it works</p>
          <p className="text-[11px] leading-relaxed text-white/60">Pick a <b className="text-white/90">target size</b> (e.g. 300 KB) and PixSqueeze auto-finds the best quality. Or drag <b className="text-white/90">quality</b> manually. Edits apply before compression.</p>
        </div>
      </div>
    </div>
  );
}
