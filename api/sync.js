const SUPABASE_URL = 'https://tgrlhiznrguxdlbrluqq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_WIU3D1w0ruAYeDaI1EPSeg_xr6k-x12';
const ALLOWED_ORIGIN = 'https://painel-compras.vercel.app';
const TRACKED_FIELDS = ['status','obs','resp','reason'];

function headers(token, extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

async function getProfile(token) {
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: headers(token) });
  if (!userResp.ok) return null;
  const user = await userResp.json();
  const email = String(user.email || '').toLowerCase();
  if (!email.endsWith('@emede.com.br') && !email.endsWith('@farmoterapica.com.br')) return null;
  const query = encodeURIComponent(email);
  const authResp = await fetch(`${SUPABASE_URL}/rest/v1/authorized_users?email=eq.${query}&active=eq.true&select=email,full_name,role`, { headers: headers(token) });
  if (!authResp.ok) return null;
  const rows = await authResp.json();
  return rows[0] || null;
}

async function readState(token) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/panel_state?id=eq.1&select=payload,updated_at,updated_by`, { headers: headers(token) });
  if (!resp.ok) throw new Error('Falha ao ler a base protegida');
  const rows = await resp.json();
  return rows[0] || { payload: { data: [], users: [], audit: [] }, updated_at: null };
}

function keyOf(r) {
  return [r.empresa || '', r.sc || '', r.item || ''].join('|');
}

function stampChanges(currentPayload, incomingPayload, profile) {
  const now = new Date().toISOString();
  const oldData = Array.isArray(currentPayload.data) ? currentPayload.data : [];
  const newData = Array.isArray(incomingPayload.data) ? incomingPayload.data : [];
  const oldMap = new Map(oldData.map(r => [keyOf(r), r]));
  const audit = Array.isArray(currentPayload.audit) ? [...currentPayload.audit] : [];
  const labels = { status: 'Status', obs: 'Observação', resp: 'Responsável', reason: 'Motivo / Pendência' };
  const emailByName = Object.fromEntries((currentPayload.users || []).map(u => [u.name, u.email || '']));

  const data = newData.map(nextRaw => {
    const next = { ...nextRaw };
    const old = oldMap.get(keyOf(next));
    const changed = !old ? ['registro'] : TRACKED_FIELDS.filter(f => String(old[f] || '') !== String(next[f] || ''));

    if (changed.length) {
      next.lastMovementAt = now;
      next.lastUpdatedBy = profile.full_name;
      next.lastUpdatedEmail = profile.email;
      changed.forEach(field => {
        audit.unshift({
          ts: Date.now(),
          user: profile.full_name,
          email: profile.email,
          empresa: next.empresa,
          sc: next.sc,
          item: next.item,
          field: field === 'registro' ? 'Registro criado/importado' : labels[field],
          before: field === 'registro' ? '—' : String(old?.[field] || '—'),
          after: field === 'registro' ? 'Incluído' : String(next[field] || '—')
        });
      });
    } else if (old) {
      next.lastMovementAt = old.lastMovementAt || now;
      next.lastUpdatedBy = old.lastUpdatedBy || 'Migração';
      next.lastUpdatedEmail = old.lastUpdatedEmail || '';
      next.closedAt = old.closedAt || null;
      next.closedBy = old.closedBy || '';
    }

    next.responsibleEmail = emailByName[next.resp] || next.responsibleEmail || '';
    const closed = ['finalizada','rejeitada'].includes(String(next.status || '').toLowerCase());
    const wasClosed = old && ['finalizada','rejeitada'].includes(String(old.status || '').toLowerCase());
    if (closed && !wasClosed) {
      next.closedAt = now;
      next.closedBy = profile.full_name;
    } else if (!closed) {
      next.closedAt = null;
      next.closedBy = '';
    }
    return next;
  });

  return {
    ...currentPayload,
    version: 6,
    data,
    users: currentPayload.users || incomingPayload.users || [],
    audit: audit.slice(0, 1000),
    ts: Date.now(),
    v: 'full'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Autenticação necessária' });
    const profile = await getProfile(token);
    if (!profile) return res.status(403).json({ error: 'E-mail não autorizado' });

    const state = await readState(token);
    if (req.method === 'GET') {
      return res.status(200).json({
        ...(state.payload || {}),
        ts: Date.parse(state.updated_at || '') || Date.now(),
        v: 'full',
        authProfile: profile
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    let incoming = req.body?.payload;
    if (!incoming) return res.status(400).json({ error: 'Payload ausente' });
    if (typeof incoming === 'string') incoming = JSON.parse(incoming);

    const payload = stampChanges(state.payload || {}, incoming, profile);
    const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/panel_state?id=eq.1`, {
      method: 'PATCH',
      headers: headers(token, { Prefer: 'return=representation' }),
      body: JSON.stringify({ payload, updated_at: new Date().toISOString(), updated_by: profile.email })
    });
    if (!updateResp.ok) throw new Error('Falha ao salvar a base protegida');
    return res.status(200).json({ ...payload, authProfile: profile });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
