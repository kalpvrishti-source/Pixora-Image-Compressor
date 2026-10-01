import { Crop, Download, Share2, Trash2, GitCompareArrows, Check, Loader2, FileImage, Eye } from 'lucide-react';
import { formatBytes } from '../lib/imageTools';
import type { PhotoItem } from '../pages/Home';

interface Props {
  photo: PhotoItem;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onDownload: () => void;
  onShare: () => void;
  onCompare: () => void;
  onQuality: (q: number) => void;
}

export default function PhotoCard({ photo, selected, onToggle, onEdit, onRemove, onDownload, onShare, onCompare, onQuality }: Props) {
  const saved = photo.compressedSize != null && photo.originalSize > 0 ? Math.max(0, Math.round((1 - photo.compressedSize / photo.originalSize) * 100)) : 0;
  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-white/[0.05] backdrop-blur transition ${selected ? 'border-fuchsia-400/70 ring-2 ring-fuchsia-500/30' : 'border-white/10 hover:border-white/25'}`}>
      <div className="relative aspect-[4/3] bg-black/40 overflow-hidden">
        <img src={photo.compressedUrl || photo.editedUrl || photo.originalUrl} alt={photo.name} className="h-full w-full object-cover" />
        <button onClick={onToggle} className={`absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur transition ${selected ? 'bg-fuchsia-500 border-fuchsia-400 text-white' : 'bg-black/50 border-white/30 text-transparent hover:border-white'}`}>
          <Check className="h-4 w-4" />
        </button>
        {photo.status === 'processing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
          </div>
        )}
        {saved > 0 && photo.status === 'done' && (
          <div className="absolute right-3 top-3 rounded-lg bg-emerald-500/90 px-2.5 py-1 text-xs font-bold text-white shadow">−{saved}%</div>
        )}
        {photo.status === 'done' && (
          <button onClick={onCompare} className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/80">
            <GitCompareArrows className="h-3.5 w-3.5" /> Compare
          </button>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white" title={photo.name}>{photo.name}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/50"><FileImage className="h-3 w-3" />{photo.width}×{photo.height}</p>
          </div>
          <button onClick={onRemove} className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-xs">
          <span className="text-white/50">{formatBytes(photo.originalSize)}</span>
          <span className="text-white/30">→</span>
          <span className="font-bold text-emerald-300">{photo.compressedSize != null ? formatBytes(photo.compressedSize) : '…'}</span>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-white/50 mb-1"><span>Quality</span><span className="font-bold text-white/80">{photo.settings.quality}%</span></div>
          <input type="range" min={5} max={95} value={photo.settings.quality} onChange={(e) => onQuality(parseInt(e.target.value))} className="w-full accent-fuchsia-500" />
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <button onClick={onEdit} title="Crop & rotate" className="flex items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-[11px] font-semibold text-white hover:bg-white/20"><Crop className="h-3.5 w-3.5" />Edit</button>
          <button onClick={onCompare} title="Compare before/after" className="flex items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-[11px] font-semibold text-white hover:bg-white/20"><Eye className="h-3.5 w-3.5" />View</button>
          <button onClick={onShare} title="Share" className="flex items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-[11px] font-semibold text-white hover:bg-white/20"><Share2 className="h-3.5 w-3.5" />Share</button>
          <button onClick={onDownload} disabled={photo.status !== 'done'} title="Download" className="flex items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 py-2 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-40"><Download className="h-3.5 w-3.5" />Save</button>
        </div>
      </div>
    </div>
  );
}
