const UPSTREAM = 'https://painel-compras-m28tvq770-compras3.vercel.app/api/sync';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  try {
    const headers = { 'Cache-Control': 'no-store' };
    if (req.headers.authorization) headers.Authorization = req.headers.authorization;
    if (req.method === 'POST') headers['Content-Type'] = 'application/json';

    const upstream = await fetch(UPSTREAM, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? JSON.stringify(req.body || {}) : undefined
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
    return res.send(body);
  } catch (error) {
    return res.status(502).json({ error: 'Falha temporária ao acessar a base compartilhada' });
  }
}
