import supabase from './db-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('presets').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { name, target_size_kb, quality, max_width, max_height, format } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      const { data, error } = await supabase.from('presets').insert({ name, target_size_kb: target_size_kb || null, quality: quality ?? 80, max_width: max_width || null, max_height: max_height || null, format: format || 'image/jpeg' }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, name, target_size_kb, quality, max_width, max_height, format } = req.body;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const payload = {};
      if (name !== undefined) payload.name = name;
      if (target_size_kb !== undefined) payload.target_size_kb = target_size_kb;
      if (quality !== undefined) payload.quality = quality;
      if (max_width !== undefined) payload.max_width = max_width;
      if (max_height !== undefined) payload.max_height = max_height;
      if (format !== undefined) payload.format = format;
      const { data, error } = await supabase.from('presets').update(payload).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const id = req.body?.id ?? req.query?.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase.from('presets').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('presets API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
