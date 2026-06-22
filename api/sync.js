const GS_URL = 'https://script.google.com/macros/s/AKfycbybIU803gqhHNSE_n27tKIFFb0KUS0Hh34_ATG6RVXqU49HHuhkJtbifNU3YMwop5Eb4A/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const payload = req.body?.payload;
      if (!payload) return res.status(400).json({ error: 'no payload' });

      const resp = await fetch(GS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'payload=' + encodeURIComponent(payload),
        redirect: 'follow'
      });
      const text = await resp.text();
      return res.status(200).send(text);
    }

    const resp = await fetch(GS_URL, { redirect: 'follow' });
    const text = await resp.text();
    return res.status(200).send(text);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
