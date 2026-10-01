import { useState, useCallback, useEffect, useRef } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { X, RotateCw, RotateCcw, FlipHorizontal2, FlipVertical2, Check, Maximize, HardDrive, Link2, Download, Share2, Loader2, Crosshair } from 'lucide-react';
import { processImageUrl, downloadBlob, shareBlob, formatBytes, mimeToExt, type CompressOptions } from '../lib/imageTools';

interface Props {
  image: string;
  initialRotation: number;
  initialFlipH: boolean;
  initialFlipV: boolean;
  photoName?: string;
  originalSize?: number;
  initialSettings?: CompressOptions;
  onClose: () => void;
  onApply: (cropPixels: { x: number; y: number; width: number; height: number } | null, rotation: number, flipH: boolean, flipV: boolean, settings?: CompressOptions) => void;
  onReplaceFiles?: (files: File[]) => void;
  onReplaceUrl?: (url: string) => void;
  onNotify?: (msg: string) => void;
}

const RATIOS = [
  { label: 'Free', value: null as number | null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];

export default function EditorModal({ image, initialRotation, initialFlipH, initialFlipV, photoName, originalSize, initialSettings, onClose, onApply, onReplaceFiles, onReplaceUrl, onNotify }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(initialRotation);
  const [flipH, setFlipH] = useState(initialFlipH);
  const [flipV, setFlipV] = useState(initialFlipV);
  const [ratio, setRatio] = useState<number | null>(null);
  const [pixels, setPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [settings, setSettings] = useState<CompressOptions>(initialSettings || { quality: 75, maxWidth: 2048, maxHeight: 2048, format: 'image/jpeg', targetSizeKb: null });
  const [preview, setPreview] = useState<{ blob: Blob; url: string; size: number; width: number; height: number; qualityUsed: number } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [urlText, setUrlText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const onCropComplete = useCallback((_a: Area, pa: Area) => {
    setPixels({ x: pa.x, y: pa.y, width: pa.width, height: pa.height });
  }, []);

  const untouched = zoom === 1 && crop.x === 0 && crop.y === 0 && ratio === null;
  const targetMode = settings.targetSizeKb != null && settings.targetSizeKb > 0;
  const set = (p: Partial<CompressOptions>) => setSettings((s) => ({ ...s, ...p }));

  // Live compression preview (debounced) using current crop/rotate + settings
  useEffect(() => {
    let cancelled = false;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const res = await processImageUrl(
          image,
          { cropPixels: untouched ? null : pixels, rotation, flipH, flipV },
          settings
        );
        if (cancelled) {
          URL.revokeObjectURL(res.url);
          return;
        }
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = res.url;
        setPreview({ blob: res.blob, url: res.url, size: res.size, width: res.width, height: res.height, qualityUsed: res.qualityUsed });
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, pixels, rotation, flipH, flipV, untouched, settings.quality, settings.maxWidth, settings.maxHeight, settings.format, settings.targetSizeKb]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const outName = () => {
    const base = (photoName || 'photo').replace(/\.[^.]+$/, '');
    return `${base}-compressed.${mimeToExt(settings.format)}`;
  };

  const handleDownload = () => {
    if (!preview?.blob) {
      onNotify?.('Preview still processing…');
      return;
    }
    downloadBlob(preview.blob, outName());
    onNotify?.(`Downloaded ${outName()}`);
  };

  const handleShare = async () => {
    if (!preview?.blob) {
      onNotify?.('Preview still processing…');
      return;
    }
    const r = await shareBlob(preview.blob, outName(), 'PixSqueeze photo');
    onNotify?.(r === 'shared' ? 'Shared!' : r === 'copied' ? 'Image copied to clipboard' : r === 'downloaded' ? 'Downloaded instead of share' : 'Share dismissed');
  };

  const submitUrl = () => {
    if (urlText.trim() && onReplaceUrl) {
      onReplaceUrl(urlText.trim());
      setUrlText('');
      setShowUrl(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#14121f] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-bold text-white text-lg">Crop & Rotate</h3>
            <p className="text-xs text-white/50 truncate">Drag to reposition • Scroll slider to zoom • {photoName || 'Applied before compression'}</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-white/10 p-2 text-white/70 hover:bg-white/20 shrink-0"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative h-[340px] sm:h-[420px] bg-black">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={ratio ?? undefined}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            showGrid
          />
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {RATIOS.map((r) => (
              <button key={r.label} onClick={() => setRatio(r.value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${ratio === r.value ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>{r.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Maximize className="h-4 w-4 text-white/50" />
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} className="flex-1 accent-fuchsia-500" />
            <span className="text-xs text-white/60 w-10">{zoom.toFixed(1)}x</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setRotation((r) => (r + 90) % 360)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"><RotateCw className="h-4 w-4" />90°</button>
            <button onClick={() => setRotation((r) => (r + 270) % 360)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"><RotateCcw className="h-4 w-4" />−90°</button>
            <button onClick={() => setFlipH(!flipH)} className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${flipH ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}><FlipHorizontal2 className="h-4 w-4" />Flip H</button>
            <button onClick={() => setFlipV(!flipV)} className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${flipV ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}><FlipVertical2 className="h-4 w-4" />Flip V</button>
          </div>

          {/* Photo source — switch photo without leaving the editor */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
            <p className="text-xs font-semibold text-white/70 mb-2">Photo source</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"><HardDrive className="h-3.5 w-3.5" />Replace from device / gallery</button>
              <button onClick={() => setShowUrl(!showUrl)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"><Link2 className="h-3.5 w-3.5" />Replace from URL</button>
            </div>
            <p className="mt-2 text-[10px] text-white/40">File picker opens your computer library, phone gallery, camera, Google Photos or Drive.</p>
            {showUrl && (
              <div className="mt-2 flex gap-2">
                <input
                  value={urlText}
                  onChange={(e) => setUrlText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitUrl(); }}
                  placeholder="Paste an image URL — https://…"
                  className="flex-1 min-w-0 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-fuchsia-400"
                />
                <button onClick={submitUrl} className="rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-xs font-bold text-white">Load</button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const f = Array.from(e.target.files || []);
                if (f.length && onReplaceFiles) onReplaceFiles(f);
                e.target.value = '';
              }}
            />
          </div>

          {/* Compression — same controls as Studio, live preview */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70"><Crosshair className="h-3.5 w-3.5 text-fuchsia-400" />Compression</span>
              <button onClick={() => set({ targetSizeKb: targetMode ? null : 300 })} className={`relative h-5 w-9 rounded-full transition ${targetMode ? 'bg-fuchsia-500' : 'bg-white/20'}`} title="Toggle target-size mode">
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${targetMode ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </div>
            {targetMode ? (
              <div>
                <div className="flex items-center gap-2">
                  <input type="number" min={10} max={20000} value={settings.targetSizeKb ?? 300} onChange={(e) => set({ targetSizeKb: Math.max(10, parseInt(e.target.value) || 10) })} className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-fuchsia-400" />
                  <span className="text-xs text-white/50 shrink-0">KB target</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {[100, 300, 500, 1024].map((kb) => (
                    <button key={kb} onClick={() => set({ targetSizeKb: kb })} className={`flex-1 rounded-lg py-1 text-[10px] font-bold transition ${settings.targetSizeKb === kb ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>{kb >= 1024 ? '1MB' : `${kb}K`}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between text-[11px] text-white/50 mb-1"><span>Quality</span><span className="font-bold text-white">{settings.quality}%</span></div>
                <input type="range" min={5} max={95} value={settings.quality} onChange={(e) => set({ quality: parseInt(e.target.value) })} className="w-full accent-fuchsia-500" />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] text-white/50 mb-1">Format</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['JPG', 'image/jpeg'], ['PNG', 'image/png'], ['WebP', 'image/webp']].map(([label, mime]) => (
                    <button key={mime} onClick={() => set({ format: mime })} className={`rounded-lg py-1.5 text-[11px] font-bold transition ${settings.format === mime ? 'bg-fuchsia-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-white/50 mb-1">Max W × H</p>
                <div className="flex items-center gap-1.5">
                  <input type="number" placeholder="W" value={settings.maxWidth ?? ''} onChange={(e) => set({ maxWidth: e.target.value ? parseInt(e.target.value) : null })} className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-fuchsia-400" />
                  <span className="text-white/30 text-xs">×</span>
                  <input type="number" placeholder="H" value={settings.maxHeight ?? ''} onChange={(e) => set({ maxHeight: e.target.value ? parseInt(e.target.value) : null })} className="w-full rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs font-bold text-white outline-none focus:border-fuchsia-400" />
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs">
              <span className="text-white/50">{originalSize ? formatBytes(originalSize) : 'Original'} →</span>
              {previewing ? (
                <span className="flex items-center gap-1.5 text-white/60"><Loader2 className="h-3.5 w-3.5 animate-spin" />Compressing…</span>
              ) : preview ? (
                <span className="font-bold text-emerald-300">{formatBytes(preview.size)} • {preview.width}×{preview.height} • Q{preview.qualityUsed}</span>
              ) : (
                <span className="text-white/40">…</span>
              )}
            </div>
          </div>

          {/* Download / Share / Apply */}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleDownload} disabled={!preview} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"><Download className="h-3.5 w-3.5" />Download</button>
            <button onClick={handleShare} disabled={!preview} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-40"><Share2 className="h-3.5 w-3.5" />Share</button>
            <div className="ml-auto flex gap-2">
              <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">Cancel</button>
              <button onClick={() => onApply(untouched ? null : pixels, rotation, flipH, flipV, settings)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-bold text-white hover:opacity-90"><Check className="h-4 w-4" />Apply</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
