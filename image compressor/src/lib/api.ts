export interface Preset {
  id: number;
  name: string;
  target_size_kb: number | null;
  quality: number;
  max_width: number | null;
  max_height: number | null;
  format: string;
  created_at: string;
}

export interface Job {
  id: number;
  file_name: string;
  original_size_kb: number;
  compressed_size_kb: number;
  format: string;
  quality: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

// ---------- localStorage fallback (works fully offline / while DB wakes) ----------
const LS_PRESETS = 'pixsqueeze_presets';
const LS_JOBS = 'pixsqueeze_jobs';

function lsGet<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}
function lsSet(key: string, val: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch { /* storage full — ignore */ }
}

const DEFAULT_PRESETS: Preset[] = [
  { id: -1, name: 'WhatsApp share (300KB)', target_size_kb: 300, quality: 80, max_width: 2048, max_height: 2048, format: 'image/jpeg', created_at: new Date().toISOString() },
  { id: -2, name: 'Passport / ID (100KB)', target_size_kb: 100, quality: 80, max_width: 1200, max_height: 1200, format: 'image/jpeg', created_at: new Date().toISOString() },
  { id: -3, name: 'Web upload (500KB WebP)', target_size_kb: 500, quality: 80, max_width: 2048, max_height: 2048, format: 'image/webp', created_at: new Date().toISOString() },
  { id: -4, name: 'High quality (1MB)', target_size_kb: 1024, quality: 90, max_width: null, max_height: null, format: 'image/jpeg', created_at: new Date().toISOString() },
];

async function j(res: Response) {
  if (!res.ok) {
    const t = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(t.error || 'Request failed');
  }
  return res.json();
}

async function withTimeout<T>(p: Promise<T>, ms = 8000): Promise<T> {
  const t = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));
  return Promise.race([p, t]);
}

export const api = {
  async getPresets(): Promise<Preset[]> {
    try {
      const remote = await withTimeout(j(await fetch('/api/presets'))) as Preset[];
      return remote;
    } catch {
      const local = lsGet<Preset>(LS_PRESETS);
      if (local.length === 0) {
        lsSet(LS_PRESETS, DEFAULT_PRESETS);
        return [...DEFAULT_PRESETS];
      }
      return local;
    }
  },
  async createPreset(p: { name: string; target_size_kb?: number | null; quality: number; max_width?: number | null; max_height?: number | null; format: string }): Promise<Preset> {
    const row: Preset = {
      id: Date.now(),
      name: p.name,
      target_size_kb: p.target_size_kb ?? null,
      quality: p.quality,
      max_width: p.max_width ?? null,
      max_height: p.max_height ?? null,
      format: p.format,
      created_at: new Date().toISOString(),
    };
    try {
      const res = await fetch('/api/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
      return await j(res);
    } catch {
      const local = lsGet<Preset>(LS_PRESETS);
      const seeded = local.length === 0 ? [...DEFAULT_PRESETS] : local;
      lsSet(LS_PRESETS, [row, ...seeded]);
      return row;
    }
  },
  async deletePreset(id: number) {
    try {
      const res = await fetch('/api/presets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      return await j(res);
    } catch {
      lsSet(LS_PRESETS, lsGet<Preset>(LS_PRESETS).filter((x) => x.id !== id));
      return { ok: true };
    }
  },
  async getJobs(limit = 50): Promise<Job[]> {
    try {
      const remote = await withTimeout(j(await fetch(`/api/jobs?limit=${limit}`))) as Job[];
      return remote;
    } catch {
      return lsGet<Job>(LS_JOBS).slice(0, limit);
    }
  },
  async logJobs(rows: { file_name: string; original_size_kb: number; compressed_size_kb: number; format: string; quality?: number | null; width?: number | null; height?: number | null }[]) {
    try {
      const res = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
      return await j(res);
    } catch {
      const stamped: Job[] = rows.map((r, i) => ({
        id: Date.now() + i,
        file_name: r.file_name,
        original_size_kb: r.original_size_kb,
        compressed_size_kb: r.compressed_size_kb,
        format: r.format,
        quality: r.quality ?? null,
        width: r.width ?? null,
        height: r.height ?? null,
        created_at: new Date().toISOString(),
      }));
      lsSet(LS_JOBS, [...stamped, ...lsGet<Job>(LS_JOBS)].slice(0, 200));
      return stamped;
    }
  },
  async clearJobs() {
    try {
      const res = await fetch('/api/jobs', { method: 'DELETE' });
      return await j(res);
    } catch {
      lsSet(LS_JOBS, []);
      return { ok: true };
    }
  },
};
