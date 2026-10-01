import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const limit = parseInt(req.query?.limit || '50', 10);
      const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(Math.min(limit, 200));
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const body = req.body;
      const rows = Array.isArray(body) ? body : [body];
      const clean = rows.filter(r => r && r.file_name).map(r => ({
        file_name: String(r.file_name).slice(0, 255),
        original_size_kb: r.original_size_kb ?? 0,
        compressed_size_kb: r.compressed_size_kb ?? 0,
        format: r.format || 'image/jpeg',
        quality: r.quality ?? null,
        width: r.width ?? null,
        height: r.height ?? null,
      }));
      if (clean.length === 0) return res.status(400).json({ error: 'file_name is required' });
      const { data, error } = await supabase.from('jobs').insert(clean).select();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'DELETE') {
      const id = req.body?.id ?? req.query?.id;
      if (id) {
        const { error } = await supabase.from('jobs').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      const { error } = await supabase.from('jobs').delete().gte('id', 0);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('jobs API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
