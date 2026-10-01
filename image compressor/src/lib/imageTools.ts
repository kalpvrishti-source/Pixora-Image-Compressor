export interface CompressOptions {
  quality: number;
  maxWidth: number | null;
  maxHeight: number | null;
  format: string;
  targetSizeKb: number | null;
}

export interface CompressResult {
  blob: Blob;
  url: string;
  size: number;
  width: number;
  height: number;
  qualityUsed: number;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / Math.pow(1024, i);
  return `${v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatKb(kb: number): string {
  if (!kb || kb <= 0) return '0 KB';
  if (kb >= 1024) return `${(kb / 1024).toFixed(2)} MB`;
  return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
}

export function mimeToExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))),
      mime,
      mime === 'image/png' ? undefined : quality
    );
  });
}

export interface EditState {
  cropPixels?: { x: number; y: number; width: number; height: number } | null;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export async function renderEditedCanvas(srcUrl: string, opts: EditState): Promise<HTMLCanvasElement> {
  const img = await loadImage(srcUrl);
  const rotation = ((opts.rotation || 0) % 360 + 360) % 360;
  const rad = (rotation * Math.PI) / 180;
  const swap = rotation === 90 || rotation === 270;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const rw = swap ? ih : iw;
  const rh = swap ? iw : ih;

  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = rw;
  rotCanvas.height = rh;
  const rctx = rotCanvas.getContext('2d')!;
  rctx.save();
  rctx.translate(rw / 2, rh / 2);
  rctx.rotate(rad);
  rctx.scale(opts.flipH ? -1 : 1, opts.flipV ? -1 : 1);
  rctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  rctx.restore();

  const crop = opts.cropPixels;
  if (crop && crop.width > 4 && crop.height > 4) {
    const cx = Math.max(0, Math.min(crop.x, rw - 1));
    const cy = Math.max(0, Math.min(crop.y, rh - 1));
    const cw = Math.max(1, Math.min(crop.width, rw - cx));
    const ch = Math.max(1, Math.min(crop.height, rh - cy));
    const out = document.createElement('canvas');
    out.width = Math.round(cw);
    out.height = Math.round(ch);
    const octx = out.getContext('2d')!;
    octx.drawImage(rotCanvas, cx, cy, cw, ch, 0, 0, out.width, out.height);
    return out;
  }
  return rotCanvas;
}

function fitSize(w: number, h: number, maxW: number | null, maxH: number | null): { w: number; h: number } {
  let nw = w;
  let nh = h;
  const mw = maxW && maxW > 0 ? maxW : null;
  const mh = maxH && maxH > 0 ? maxH : null;
  if (mw && nw > mw) {
    nh = Math.round((nh * mw) / nw);
    nw = mw;
  }
  if (mh && nh > mh) {
    nw = Math.round((nw * mh) / nh);
    nh = mh;
  }
  return { w: Math.max(1, nw), h: Math.max(1, nh) };
}

export async function compressCanvas(sourceCanvas: HTMLCanvasElement, opts: CompressOptions): Promise<CompressResult> {
  const format = opts.format || 'image/jpeg';
  const { w, h } = fitSize(sourceCanvas.width, sourceCanvas.height, opts.maxWidth, opts.maxHeight);

  const makeSized = (W: number, H: number) => {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d')!;
    if (format === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, W, H);
    return c;
  };

  if (format === 'image/png') {
    const c = makeSized(w, h);
    const blob = await canvasToBlob(c, format, 1);
    const url = URL.createObjectURL(blob);
    return { blob, url, size: blob.size, width: w, height: h, qualityUsed: 100 };
  }

  const targetBytes = opts.targetSizeKb && opts.targetSizeKb > 0 ? Math.round(opts.targetSizeKb * 1024) : null;

  if (!targetBytes) {
    const q = Math.min(1, Math.max(0.05, opts.quality / 100));
    const c = makeSized(w, h);
    const blob = await canvasToBlob(c, format, q);
    const url = URL.createObjectURL(blob);
    return { blob, url, size: blob.size, width: w, height: h, qualityUsed: Math.round(q * 100) };
  }

  let curW = w;
  let curH = h;
  let best: CompressResult | null = null;
  for (let shrink = 0; shrink < 6; shrink++) {
    let lo = 5;
    let hi = 95;
    let localBest: CompressResult | null = null;
    for (let i = 0; i < 7; i++) {
      const mid = Math.round((lo + hi) / 2);
      const c = makeSized(curW, curH);
      const blob = await canvasToBlob(c, format, mid / 100);
      if (blob.size <= targetBytes) {
        if (localBest) URL.revokeObjectURL(localBest.url);
        localBest = { blob, url: URL.createObjectURL(blob), size: blob.size, width: curW, height: curH, qualityUsed: mid };
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
      if (lo > hi) break;
    }
    if (localBest) {
      best = localBest;
      break;
    }
    curW = Math.max(64, Math.round(curW * 0.8));
    curH = Math.max(64, Math.round(curH * 0.8));
    if (curW <= 64 || curH <= 64) {
      const c = makeSized(curW, curH);
      const blob = await canvasToBlob(c, format, 0.05);
      best = { blob, url: URL.createObjectURL(blob), size: blob.size, width: curW, height: curH, qualityUsed: 5 };
      break;
    }
  }
  if (!best) {
    const c = makeSized(curW, curH);
    const blob = await canvasToBlob(c, format, 0.6);
    best = { blob, url: URL.createObjectURL(blob), size: blob.size, width: curW, height: curH, qualityUsed: 60 };
  }
  return best;
}

export async function processImageUrl(
  srcUrl: string,
  edit: { cropPixels?: { x: number; y: number; width: number; height: number } | null; rotation: number; flipH: boolean; flipV: boolean },
  comp: CompressOptions
): Promise<CompressResult & { editedUrl: string; editedWidth: number; editedHeight: number }> {
  const editedCanvas = await renderEditedCanvas(srcUrl, { cropPixels: edit.cropPixels || null, rotation: edit.rotation, flipH: edit.flipH, flipV: edit.flipV });
  const editedUrl = editedCanvas.toDataURL('image/jpeg', 0.9);
  const out = await compressCanvas(editedCanvas, comp);
  return { ...out, editedUrl, editedWidth: editedCanvas.width, editedHeight: editedCanvas.height };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function shareBlob(blob: Blob, filename: string, title = 'Compressed photo'): Promise<'shared' | 'copied' | 'downloaded' | 'unsupported'> {
  try {
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as unknown as { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title: string; text: string }) => Promise<void> };
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title, text: title });
      return 'shared';
    }
    if (navigator.clipboard && (window as unknown as { ClipboardItem?: unknown }).ClipboardItem) {
      const ClipboardItemCtor = (window as unknown as { ClipboardItem: new (d: Record<string, Blob>) => unknown }).ClipboardItem;
      const item = new ClipboardItemCtor({ [blob.type]: blob });
      await navigator.clipboard.write([item as ClipboardItem]);
      return 'copied';
    }
    downloadBlob(blob, filename);
    return 'downloaded';
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === 'AbortError') return 'unsupported';
    try {
      downloadBlob(blob, filename);
      return 'downloaded';
    } catch {
      return 'unsupported';
    }
  }
}

export async function urlToFile(imageUrl: string): Promise<{ blob: Blob; name: string }> {
  const clean = imageUrl.trim();
  try {
    const res = await fetch(clean, { mode: 'cors' });
    if (!res.ok) throw new Error(`Could not fetch (${res.status})`);
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) throw new Error('That URL did not return an image');
    const parts = clean.split('?')[0].split('/');
    let name = parts[parts.length - 1] || `web-image-${Date.now()}.jpg`;
    if (!/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(name)) name += '.jpg';
    return { blob, name };
  } catch (err) {
    try {
      const stripped = clean.replace(/^https?:\/\//, '');
      const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}`;
      const res = await fetch(proxy);
      if (!res.ok) throw new Error('Image host blocked direct loading');
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Could not load image from that URL');
      return { blob, name: `web-image-${Date.now()}.jpg` };
    } catch {
      throw err;
    }
  }
}
