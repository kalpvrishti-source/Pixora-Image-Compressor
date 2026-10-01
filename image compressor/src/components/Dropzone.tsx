import { useRef, useState } from 'react';
import { CloudUpload, FolderOpen, Link2, ClipboardPaste, Smartphone, HardDrive, Sparkles, Images } from 'lucide-react';

interface Props {
  onFiles: (files: File[]) => void;
  onUrl: (url: string) => void;
  onSamples: () => void;
  loadingUrl: boolean;
}

export default function Dropzone({ onFiles, onUrl, onSamples, loadingUrl }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [url, setUrl] = useState('');
  const [showUrl, setShowUrl] = useState(false);

  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = Array.from(e.target.files || []);
    if (f.length) onFiles(f);
    e.target.value = '';
  };

  const submitUrl = () => {
    if (url.trim()) {
      onUrl(url.trim());
      setUrl('');
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = Array.from(e.dataTransfer.files || []).filter((x) => x.type.startsWith('image/'));
          if (f.length) onFiles(f as File[]);
        }}
        onClick={() => fileRef.current?.click()}
        className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-300 ${drag ? 'border-fuchsia-400 bg-fuchsia-500/10 scale-[1.01]' : 'border-white/20 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.07]'}`}
      >
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">
          <CloudUpload className="h-8 w-8 text-white" />
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-white">Drop photos here or click to browse</h3>
        <p className="mt-2 text-sm text-white/60 max-w-xl mx-auto">
          From your computer, phone gallery, Google Photos, Drive or any folder. JPG, PNG, WebP, GIF, BMP — everything stays on your device until you download.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => fileRef.current?.click()} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 transition flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> Computer / Phone
          </button>
          <button onClick={() => folderRef.current?.click()} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition flex items-center gap-2 border border-white/10">
            <FolderOpen className="h-4 w-4" /> Whole folder
          </button>
          <button onClick={() => setShowUrl(!showUrl)} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition flex items-center gap-2 border border-white/10">
            <Link2 className="h-4 w-4" /> Image URL
          </button>
          <button onClick={onSamples} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition flex items-center gap-2 border border-white/10">
            <Sparkles className="h-4 w-4" /> Try samples
          </button>
        </div>
        {showUrl && (
          <div className="mx-auto mt-5 flex max-w-xl gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitUrl(); }}
              placeholder="Paste an image URL — https://…"
              className="flex-1 rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-fuchsia-400"
            />
            <button
              disabled={loadingUrl || !url.trim()}
              onClick={submitUrl}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {loadingUrl ? 'Loading…' : 'Add'}
            </button>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/50">
          <span className="flex items-center gap-1.5"><Images className="h-3.5 w-3.5" /> Multi-select supported</span>
          <span className="flex items-center gap-1.5"><ClipboardPaste className="h-3.5 w-3.5" /> Press Ctrl+V to paste</span>
          <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> Mobile camera & gallery ready</span>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={pickFiles} />
      <input ref={folderRef} type="file" accept="image/*" multiple {...({ webkitdirectory: '' } as Record<string, string>)} className="hidden" onChange={pickFiles} />
    </div>
  );
}
