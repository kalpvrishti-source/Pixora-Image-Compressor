import { useCallback, useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Zap, Download, Trash2, Images, Smartphone, FolderSync, Cloud, MousePointerClick, Scissors, Share2, ShieldCheck, Sparkles, X, ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import Dropzone from '../components/Dropzone';
import PhotoCard from '../components/PhotoCard';
import EditorModal from '../components/EditorModal';
import GlobalSettings from '../components/GlobalSettings';
import PresetsPanel from '../components/PresetsPanel';
import HistoryPanel from '../components/HistoryPanel';
import { api, type Preset, type Job } from '../lib/api';
import { uid, formatBytes, loadImage, processImageUrl, downloadBlob, shareBlob, mimeToExt, urlToFile, type CompressOptions } from '../lib/imageTools';

export interface PhotoItem {
  id: string;
  name: string;
  originalUrl: string;
  originalSize: number;
  originalBlob: Blob;
  width: number;
  height: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  cropPixels: { x: number; y: number; width: number; height: number } | null;
  editedUrl: string | null;
  settings: CompressOptions;
  compressedUrl: string | null;
  compressedBlob: Blob | null;
  compressedSize: number | null;
  outWidth: number | null;
  outHeight: number | null;
  qualityUsed: number | null;
  status: 'pending' | 'processing' | 'done' | 'error';
}

const SAMPLES = [
  { url: '/samples/sample-1.jpg', name: 'mountain-lake.jpg' },
  { url: '/samples/sample-2.jpg', name: 'city-street.jpg' },
  { url: '/samples/sample-3.jpg', name: 'portrait-smile.jpg' },
  { url: '/samples/sample-4.jpg', name: 'beach-sunset.jpg' },
  { url: '/samples/sample-5.jpg', name: 'forest-path.jpg' },
  { url: '/samples/sample-6.jpg', name: 'food-flatlay.jpg' },
];

const DEFAULTS: CompressOptions = { quality: 75, maxWidth: 2048, maxHeight: 2048, format: 'image/jpeg', targetSizeKb: null };

export default function Home() {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [globalSettings, setGlobalSettings] = useState<CompressOptions>(DEFAULTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [savingPreset, setSavingPreset] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [compareSlider, setCompareSlider] = useState(50);
  const workRef = useRef(false);
  const globalRef = useRef(globalSettings);
  globalRef.current = globalSettings;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const fetchPresets = useCallback(async () => {
    try { setPresets(await api.getPresets()); } catch { /* db may be waking */ } finally { setPresetsLoading(false); }
  }, []);
  const fetchJobs = useCallback(async () => {
    try { setJobs(await api.getJobs()); } catch { /* ignore */ } finally { setJobsLoading(false); }
  }, []);
  useEffect(() => { fetchPresets(); fetchJobs(); }, [fetchPresets, fetchJobs]);

  const addFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) { showToast('No image files detected'); return; }
    const items: PhotoItem[] = [];
    for (const b of imgs) {
      try {
        const url = URL.createObjectURL(b);
        const img = await loadImage(url);
        items.push({
          id: uid(),
          name: b.name || `photo-${Date.now()}.jpg`,
          originalUrl: url,
          originalSize: b.size,
          originalBlob: b,
          width: img.naturalWidth,
          height: img.naturalHeight,
          rotation: 0, flipH: false, flipV: false, cropPixels: null,
          editedUrl: null,
          settings: { ...globalRef.current },
          compressedUrl: null, compressedBlob: null, compressedSize: null,
          outWidth: null, outHeight: null, qualityUsed: null,
          status: 'pending',
        });
      } catch {
        showToast('Skipped an unreadable image');
      }
    }
    if (items.length) {
      setPhotos((prev) => [...items, ...prev]);
      setSelected(new Set(items.map((i) => i.id)));
      showToast(`${items.length} photo${items.length > 1 ? 's' : ''} added — compressing…`);
      setTimeout(() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }), 200);
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || []);
      const files: File[] = [];
      items.forEach((it, i) => {
        if (it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(new File([f], `pasted-${Date.now()}-${i}.png`, { type: f.type }));
        }
      });
      if (files.length) {
        addFiles(files);
        showToast(`${files.length} image${files.length > 1 ? 's' : ''} pasted from clipboard`);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const compressOne = useCallback(async (photo: PhotoItem, settings: CompressOptions) => {
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'processing' } : p)));
    try {
      const res = await processImageUrl(
        photo.originalUrl,
        { cropPixels: photo.cropPixels, rotation: photo.rotation, flipH: photo.flipH, flipV: photo.flipV },
        settings
      );
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, compressedUrl: res.url, compressedBlob: res.blob, compressedSize: res.size, outWidth: res.width, outHeight: res.height, qualityUsed: res.qualityUsed, editedUrl: res.editedUrl, status: 'done', settings: { ...settings } }
            : p
        )
      );
      api.logJobs([{ file_name: photo.name, original_size_kb: photo.originalSize / 1024, compressed_size_kb: res.size / 1024, format: settings.format, quality: res.qualityUsed, width: res.width, height: res.height }])
        .then(() => fetchJobs())
        .catch(() => {});
    } catch (err) {
      console.error(err);
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'error' } : p)));
    }
  }, [fetchJobs]);

  useEffect(() => {
    if (workRef.current) return;
    const pending = photos.find((p) => p.status === 'pending');
    if (!pending) return;
    workRef.current = true;
    compressOne(pending, pending.settings).finally(() => {
      workRef.current = false;
    });
  }, [photos, compressOne]);

  const buildItems = async (files: { blob: Blob; name: string }[]): Promise<PhotoItem[]> => {
    const items: PhotoItem[] = [];
    for (const f of files) {
      try {
        const url = URL.createObjectURL(f.blob);
        const img = await loadImage(url);
        items.push({
          id: uid(),
          name: f.name,
          originalUrl: url,
          originalSize: f.blob.size,
          originalBlob: f.blob,
          width: img.naturalWidth,
          height: img.naturalHeight,
          rotation: 0, flipH: false, flipV: false, cropPixels: null,
          editedUrl: null,
          settings: { ...globalRef.current },
          compressedUrl: null, compressedBlob: null, compressedSize: null,
          outWidth: null, outHeight: null, qualityUsed: null,
          status: 'pending',
        });
      } catch {
        showToast(`Skipped ${f.name} — not a readable image`);
      }
    }
    return items;
  };

  const addFromUrl = async (url: string) => {
    setLoadingUrl(true);
    try {
      const { blob, name } = await urlToFile(url);
      const items = await buildItems([{ blob, name }]);
      if (items.length) {
        setPhotos((prev) => [...items, ...prev]);
        showToast('Image loaded from URL');
        setTimeout(() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }), 200);
      }
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Could not load that URL');
    } finally {
      setLoadingUrl(false);
    }
  };

  const addSamples = async () => {
    setLoadingSamples(true);
    try {
      const files: { blob: Blob; name: string }[] = [];
      for (const s of SAMPLES) {
        try {
          const res = await fetch(s.url);
          if (!res.ok) continue;
          const blob = await res.blob();
          files.push({ blob, name: s.name });
        } catch { /* skip */ }
      }
      if (files.length === 0) { showToast('Sample images unavailable'); return; }
      const items = await buildItems(files);
      setPhotos((prev) => [...items, ...prev]);
      setSelected(new Set(items.map((i) => i.id)));
      showToast(`${items.length} sample photos added`);
      setTimeout(() => document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' }), 200);
    } finally {
      setLoadingSamples(false);
    }
  };

  const recompressAll = (settings: CompressOptions, onlySelected = false) => {
    const targets = photos.filter((p) => (!onlySelected || selected.has(p.id)) && p.status !== 'processing');
    if (targets.length === 0) return;
    const ids = new Set(targets.map((t) => t.id));
    setPhotos((prev) => prev.map((p) => (ids.has(p.id) ? { ...p, settings: { ...settings }, status: 'pending' as const } : p)));
    showToast(`Re-compressing ${targets.length} photo${targets.length > 1 ? 's' : ''}…`);
  };

  const outName = (p: PhotoItem) => {
    const base = p.name.replace(/\.[^.]+$/, '');
    return `${base}-compressed.${mimeToExt(p.settings.format)}`;
  };

  const downloadOne = (p: PhotoItem) => {
    if (!p.compressedBlob) return;
    downloadBlob(p.compressedBlob, outName(p));
    showToast(`Downloaded ${outName(p)}`);
  };

  const shareOne = async (p: PhotoItem) => {
    if (!p.compressedBlob) return;
    const r = await shareBlob(p.compressedBlob, outName(p), 'PixSqueeze photo');
    showToast(r === 'shared' ? 'Shared!' : r === 'copied' ? 'Image copied to clipboard' : r === 'downloaded' ? 'Downloaded instead of share' : 'Share dismissed');
  };

  const downloadZip = async () => {
    const targets = photos.filter((p) => p.compressedBlob && (selected.size === 0 || selected.has(p.id)));
    if (targets.length === 0) { showToast('Nothing compressed yet'); return; }
    showToast('Preparing ZIP…');
    const zip = new JSZip();
    targets.forEach((p) => { if (p.compressedBlob) zip.file(outName(p), p.compressedBlob); });
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `pixsqueeze-${targets.length}-photos.zip`);
    showToast(`Downloaded ${targets.length} photos as ZIP`);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const replaceEditingSource = async (blob: Blob, name: string) => {
    if (!editingId) return;
    try {
      const url = URL.createObjectURL(blob);
      const img = await loadImage(url);
      setPhotos((prev) => prev.map((p) => p.id === editingId ? {
        ...p,
        name,
        originalUrl: url,
        originalSize: blob.size,
        originalBlob: blob,
        width: img.naturalWidth,
        height: img.naturalHeight,
        rotation: 0, flipH: false, flipV: false, cropPixels: null,
        editedUrl: null,
        compressedUrl: null, compressedBlob: null, compressedSize: null,
        outWidth: null, outHeight: null, qualityUsed: null,
        status: 'pending' as const,
      } : p));
      showToast('Photo replaced — editor updated');
    } catch {
      showToast('Could not load that image');
    }
  };

  const replaceFromFiles = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (imgs.length === 0) { showToast('No image files detected'); return; }
    await replaceEditingSource(imgs[0], imgs[0].name || `photo-${Date.now()}.jpg`);
    if (imgs.length > 1) {
      const rest = await buildItems(imgs.slice(1).map((b) => ({ blob: b, name: b.name || `photo-${Date.now()}.jpg` })));
      if (rest.length) {
        setPhotos((prev) => [...rest, ...prev]);
        showToast(`Photo replaced + ${rest.length} more added to Studio`);
      }
    }
  };

  const replaceFromUrl = async (url: string) => {
    try {
      const { blob, name } = await urlToFile(url);
      await replaceEditingSource(blob, name);
    } catch (e: unknown) {
      showToast((e as Error)?.message || 'Could not load that URL');
    }
  };

  const editing = photos.find((p) => p.id === editingId) || null;
  const comparing = compareIdx != null ? photos[compareIdx] : null;
  const doneCount = photos.filter((p) => p.status === 'done').length;
  const totalOrig = photos.reduce((a, p) => a + p.originalSize, 0);
  const totalComp = photos.reduce((a, p) => a + (p.compressedSize || 0), 0);

  return (
    <div className="min-h-screen bg-[#0b0a14] text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600/25 via-violet-600/25 to-fuchsia-600/25 blur-3xl" />
        <div className="absolute top-[60%] -left-40 h-[400px] w-[400px] rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-[40%] -right-40 h-[400px] w-[400px] rounded-full bg-fuchsia-600/10 blur-3xl" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-fuchsia-500/30">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-extrabold text-lg leading-none tracking-tight">PixSqueeze</p>
            <p className="text-[11px] text-white/50">compress • crop • share</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/60">
          <a href="#sources" className="hover:text-white transition">Sources</a>
          <a href="#workspace" className="hover:text-white transition">Studio</a>
          <a href="#presets" className="hover:text-white transition">Presets</a>
          <a href="#history" className="hover:text-white transition">History</a>
          <a href="#guide" className="hover:text-white transition">Mobile guide</a>
        </nav>
        <a href="#sources" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-100 transition">Start free</a>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pt-6 pb-10 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/70 mb-5">
          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400" /> Free • No signup • 100% private in-browser processing
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
          Pick photos <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">anywhere</span>, squeeze them to any size
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-white/60">
          Pull images from your computer, phone gallery, Google Photos, Drive or a link — then compress to an exact KB target, crop & rotate, and download or share in one tap.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="#sources" className="rounded-2xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-bold shadow-lg shadow-fuchsia-500/30 hover:opacity-90">Choose photos</a>
          <button onClick={addSamples} disabled={loadingSamples} className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-50">
            {loadingSamples ? 'Loading…' : 'Try with samples'}
          </button>
        </div>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto text-left">
          {[
            { icon: Images, t: 'Any source', d: 'Files, folders, URLs, paste' },
            { icon: Scissors, t: 'Crop + rotate', d: 'Visual editor per photo' },
            { icon: Zap, t: 'Exact size', d: 'Hit 100KB, 500KB, 1MB…' },
            { icon: Share2, t: 'Share anywhere', d: 'Download, ZIP, mobile share' },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
              <f.icon className="h-5 w-5 text-fuchsia-400 mb-2" />
              <p className="text-sm font-bold">{f.t}</p>
              <p className="text-[11px] text-white/50">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="sources" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pb-8 scroll-mt-20">
        <Dropzone onFiles={addFiles} onUrl={addFromUrl} onSamples={addSamples} loadingUrl={loadingUrl} />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20"><Smartphone className="h-5 w-5 text-indigo-300" /></div>
            <div><p className="text-sm font-bold">On mobile?</p><p className="text-xs text-white/55 mt-0.5">Tap “Computer / Phone” — your gallery & camera appear. On iPhone choose <b>Photo Library</b>, on Android pick <b>Gallery, Photos or Drive</b>.</p></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20"><FolderSync className="h-5 w-5 text-emerald-300" /></div>
            <div><p className="text-sm font-bold">Google Photos / Drive</p><p className="text-xs text-white/55 mt-0.5">In the file picker choose <b>Google Photos</b> or <b>Drive</b> from the sidebar. Or share any photo to your browser, then upload here.</p></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/20"><ShieldCheck className="h-5 w-5 text-fuchsia-300" /></div>
            <div><p className="text-sm font-bold">Private by design</p><p className="text-xs text-white/55 mt-0.5">Compression runs locally in your browser. Only tiny stats (filename, sizes) are saved to history — never your photos.</p></div>
          </div>
        </div>
      </section>

      <section id="workspace" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pb-8 scroll-mt-20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><MousePointerClick className="h-5 w-5 text-fuchsia-400" />Studio</h2>
          {photos.length > 0 && (
            <p className="text-xs text-white/50">{doneCount}/{photos.length} ready • {formatBytes(totalOrig)} → <b className="text-emerald-300">{formatBytes(totalComp)}</b></p>
          )}
        </div>

        <GlobalSettings value={globalSettings} onChange={setGlobalSettings} count={photos.length} onApplyAll={() => recompressAll(globalSettings)} />

        {photos.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-14 text-center">
            <Images className="mx-auto h-10 w-10 text-white/20 mb-3" />
            <p className="font-bold text-white/80">Your studio is empty</p>
            <p className="mt-1 text-sm text-white/45">Add photos above to start compressing, cropping and sharing.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
              <button onClick={() => { if (selected.size === photos.length) setSelected(new Set()); else setSelected(new Set(photos.map((p) => p.id))); }} className="rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold hover:bg-white/20">
                {selected.size === photos.length ? 'Deselect all' : `Select all (${photos.length})`}
              </button>
              <span className="text-xs text-white/50">{selected.size} selected</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button onClick={() => recompressAll(globalSettings, true)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/20"><Zap className="h-3.5 w-3.5" />Compress selected</button>
                <button onClick={downloadZip} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-xs font-bold hover:opacity-90"><Download className="h-3.5 w-3.5" />Download ZIP</button>
                <button onClick={() => { setPhotos([]); setSelected(new Set()); }} className="flex items-center gap-1.5 rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-500/30"><Trash2 className="h-3.5 w-3.5" />Clear</button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {photos.map((p, idx) => (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  selected={selected.has(p.id)}
                  onToggle={() => toggleSelect(p.id)}
                  onEdit={() => setEditingId(p.id)}
                  onRemove={() => setPhotos((prev) => prev.filter((x) => x.id !== p.id))}
                  onDownload={() => downloadOne(p)}
                  onShare={() => shareOne(p)}
                  onCompare={() => { setCompareIdx(idx); setCompareSlider(50); }}
                  onQuality={(q) => {
                    const s = { ...p.settings, quality: q, targetSizeKb: null };
                    setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, settings: s, status: 'pending' as const } : x)));
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section id="presets" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 pb-4 scroll-mt-20 grid gap-4 lg:grid-cols-2">
        <PresetsPanel
          presets={presets} loading={presetsLoading} saving={savingPreset}
          onApply={(p) => {
            const s: CompressOptions = { quality: p.quality, maxWidth: p.max_width, maxHeight: p.max_height, format: p.format, targetSizeKb: p.target_size_kb };
            setGlobalSettings(s);
            if (photos.length) recompressAll(s);
            showToast(`Preset "${p.name}" applied`);
          }}
          onSave={async (name) => {
            setSavingPreset(true);
            try {
              await api.createPreset({ name, target_size_kb: globalSettings.targetSizeKb, quality: globalSettings.quality, max_width: globalSettings.maxWidth, max_height: globalSettings.maxHeight, format: globalSettings.format });
              await fetchPresets();
              showToast('Preset saved to cloud');
            } catch { showToast('Could not save preset'); } finally { setSavingPreset(false); }
          }}
          onDelete={async (id) => { try { await api.deletePreset(id); await fetchPresets(); } catch { /* ignore */ } }}
        />
        <div id="history" className="scroll-mt-20">
          <HistoryPanel jobs={jobs} loading={jobsLoading} onClear={async () => { try { await api.clearJobs(); await fetchJobs(); showToast('History cleared'); } catch { /* ignore */ } }} />
        </div>
      </section>

      <section id="guide" className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 py-10 scroll-mt-20">
        <h2 className="text-xl font-extrabold mb-1 flex items-center gap-2"><Cloud className="h-5 w-5 text-fuchsia-400" />Get photos from anywhere</h2>
        <p className="text-sm text-white/50 mb-5">Browsers can&apos;t browse Google Photos or Drive directly — but these 10-second flows work everywhere.</p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '01', t: 'Computer', d: 'Click "Computer / Phone" or drag files in. Use "Whole folder" to import an entire shoot at once.' },
            { n: '02', t: 'iPhone / Android gallery', d: 'Tap "Computer / Phone", then choose Photo Library / Gallery. Multi-select works. You can also snap a new photo with the camera option.' },
            { n: '03', t: 'Google Photos', d: 'Open photos.google.com, select pictures → Download. Then drop them here. On mobile, use Share → Save to Files, then upload.' },
            { n: '04', t: 'Google Drive / Dropbox', d: 'Open Drive, select files → Download, then drop here. Or copy a public image link and use "Image URL".' },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-extrabold text-fuchsia-400 tracking-widest">{s.n}</p>
              <p className="mt-1 font-bold">{s.t}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-white/55">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-white/40">
        PixSqueeze — squeeze photos to any size. Built for photographers, students, job seekers & everyone fighting upload limits.
      </footer>

      {editing && (
        <EditorModal
          key={editing.id + editing.originalUrl}
          image={editing.originalUrl}
          initialRotation={editing.rotation}
          initialFlipH={editing.flipH}
          initialFlipV={editing.flipV}
          photoName={editing.name}
          originalSize={editing.originalSize}
          initialSettings={editing.settings}
          onClose={() => setEditingId(null)}
          onReplaceFiles={replaceFromFiles}
          onReplaceUrl={replaceFromUrl}
          onNotify={showToast}
          onApply={(cropPixels, rotation, flipH, flipV, modalSettings) => {
            setPhotos((prev) => prev.map((p) => (p.id === editing.id ? { ...p, cropPixels, rotation, flipH, flipV, settings: modalSettings ? { ...modalSettings } : p.settings, status: 'pending' as const } : p)));
            setEditingId(null);
            showToast('Edits applied — re-compressing…');
          }}
        />
      )}

      {comparing && compareIdx != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setCompareIdx(null)}>
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-[#14121f]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{comparing.name}</p>
                <p className="text-[11px] text-white/50">{formatBytes(comparing.originalSize)} → {comparing.compressedSize != null ? formatBytes(comparing.compressedSize) : '…'} {comparing.qualityUsed ? `• Q${comparing.qualityUsed}` : ''} {comparing.outWidth ? `• ${comparing.outWidth}×${comparing.outHeight}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={compareIdx === 0} onClick={() => { setCompareIdx(compareIdx - 1); setCompareSlider(50); }} className="rounded-lg bg-white/10 p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <span className="text-xs text-white/50">{compareIdx + 1}/{photos.length}</span>
                <button disabled={compareIdx === photos.length - 1} onClick={() => { setCompareIdx(compareIdx + 1); setCompareSlider(50); }} className="rounded-lg bg-white/10 p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                <button onClick={() => setCompareIdx(null)} className="rounded-lg bg-white/10 p-2"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="relative h-[50vh] sm:h-[60vh] select-none overflow-hidden bg-black">
              <img src={comparing.editedUrl || comparing.originalUrl} alt="original" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
              <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${compareSlider}%` }}>
                <img src={comparing.compressedUrl || comparing.originalUrl} alt="compressed" className="absolute inset-0 h-full max-w-none object-contain" style={{ width: 'calc(100vw - 2rem)', maxWidth: '56rem' }} draggable={false} />
                <div className="absolute right-2 top-3 rounded-lg bg-fuchsia-500/90 px-2 py-1 text-[10px] font-bold">AFTER</div>
              </div>
              <div className="absolute inset-y-0" style={{ left: `${compareSlider}%` }}>
                <div className="h-full w-0.5 bg-white shadow" />
                <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-900 shadow-lg">↔</div>
              </div>
              <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold backdrop-blur">BEFORE</div>
              <input type="range" min={0} max={100} value={compareSlider} onChange={(e) => setCompareSlider(parseInt(e.target.value))} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-3.5">
              <button onClick={() => downloadOne(comparing)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-xs font-bold"><Download className="h-3.5 w-3.5" />Download</button>
              <button onClick={() => shareOne(comparing)} className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold"><Share2 className="h-3.5 w-3.5" />Share</button>
              <button onClick={() => { setCompareIdx(null); setEditingId(comparing.id); }} className="rounded-xl bg-white/10 px-4 py-2 text-xs font-bold">Crop / Rotate</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/15 bg-[#1c1930]/95 px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur whitespace-nowrap max-w-[90vw] overflow-hidden">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /><span className="truncate">{toast}</span>
        </div>
      )}
      {loadingSamples && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" /></div>
      )}
    </div>
  );
}
