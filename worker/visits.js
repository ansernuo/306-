const ALLOWED_ORIGINS = new Set(['https://rray1228.github.io'])

export async function handleVisits(request, db, now = new Date()) {
  const origin = request.headers.get('Origin')
  const sameOrigin = !origin || origin === new URL(request.url).origin
  if (!sameOrigin && !ALLOWED_ORIGINS.has(origin)) return new Response('Forbidden', { status: 403 })
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' }
  if (!sameOrigin) headers['Access-Control-Allow-Origin'] = origin
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
  if (!['GET', 'POST'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'GET, POST, OPTIONS' } })
  if (!db) return Response.json({ error: 'Visitor storage unavailable' }, { status: 503, headers })
  // Asia/Shanghai calendar day, independent of the server's timezone.
  const day = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
  try {
    const queries = []
    if (request.method === 'POST') {
      if (Number(request.headers.get('Content-Length')) > 512) return new Response('Too large', { status: 413, headers })
      let body
      try { const text = await request.text(); if (text.length > 512) return new Response('Too large', { status: 413, headers }); body = JSON.parse(text) } catch { return new Response('Invalid JSON', { status: 400, headers }) }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body?.visitorId || '')) return new Response('Invalid visitor', { status: 400, headers })
      queries.push(db.prepare('INSERT OR IGNORE INTO site_visitors (visitor_id, first_seen) VALUES (?, ?)').bind(body.visitorId, now.toISOString()))
      queries.push(db.prepare('INSERT OR IGNORE INTO site_visitor_days (day, visitor_id) VALUES (?, ?)').bind(day, body.visitorId))
    }
    queries.push(db.prepare('SELECT COUNT(*) AS count FROM site_visitor_days WHERE day = ?').bind(day))
    queries.push(db.prepare('SELECT COUNT(*) AS count FROM site_visitors'))
    const results = await db.batch(queries)
    return Response.json({ todayVisitors: results.at(-2).results[0].count, totalVisitors: results.at(-1).results[0].count }, { headers })
  } catch { return Response.json({ error: 'Visitor statistics unavailable' }, { status: 503, headers }) }
}
