const express  = require('express');
const router   = express.Router();
const axios    = require('axios');
const { ensureAuth } = require('../middleware/auth');

const VIP_IDS     = new Set(['1399858722137968650','1476955134280863774']);
const OWNER_ID    = '1476955134280863774';
const COOLDOWN_MS = 10 * 60 * 1000;

// State
const cooldowns   = {};   // { user_id: timestamp }
const leaderboard = {};   // { user_id: { username, count, last } }
const jobResults  = {};   // { job_id: result }
let   workerUrl   = null;
const workerSecret = process.env.WORKER_SECRET || 'change_this';

const SOURCES = {
  snusbase:        { name:'Snusbase',        color:'#4ade80' },
  leakcheck:       { name:'LeakCheck',       color:'#38bdf8' },
  hackcheck:       { name:'HackCheck',       color:'#a78bfa' },
  breachbase:      { name:'BreachBase',      color:'#fb923c' },
  intelvault:      { name:'IntelVault',      color:'#fbbf24' },
  inf0sec:         { name:'Inf0sec',         color:'#e879f9' },
  seon:            { name:'SEON',            color:'#34d399' },
  leaksight:       { name:'LeakSight',       color:'#2dd4bf' },
  database:        { name:'Database',        color:'#60a5fa' },
  akula:           { name:'Akula',           color:'#fdba74' },
  intelx_logs:     { name:'IntelX Logs',     color:'#6ee7b7' },
  telegram_scan:   { name:'Telegram Scan',   color:'#93c5fd' },
  infodra:         { name:'Infodra',         color:'#86efac' },
  discord_lookup:  { name:'Discord Lookup',  color:'#c4b5fd' },
  russian_api:     { name:'Russian API',     color:'#f472b6' },
  ghosint:         { name:'Ghosint',         color:'#fda4af' },
};

function detectType(q) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return 'email';
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(q)) return 'ip';
  if (/^\+?[\d\s\-().]{8,15}$/.test(q)) return 'phone';
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}(\.[a-zA-Z]{2,})+$/.test(q)) return 'domain';
  return 'username';
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// ── GET /api/sources ──────────────────────────────────────────────────────────
router.get('/sources', ensureAuth, (req, res) => res.json({ sources: SOURCES }));

// ── GET /api/me ───────────────────────────────────────────────────────────────
router.get('/me', ensureAuth, (req, res) => {
  const u = req.user;
  const isVip = VIP_IDS.has(u.id);
  const last  = cooldowns[u.id] || 0;
  const remainingMs = isVip ? 0 : Math.max(0, COOLDOWN_MS - (Date.now() - last));
  const lb = leaderboard[u.id];
  res.json({
    id: u.id, username: u.username, avatar: u.avatar,
    plan: isVip ? 'VIP' : 'Free', isVip, isOwner: u.id === OWNER_ID,
    searches: lb?.count || 0,
    cooldown: { active: remainingMs > 0, remainingMs, remainingSec: Math.ceil(remainingMs/1000), isVip }
  });
});

// ── GET /api/status ───────────────────────────────────────────────────────────
router.get('/status', ensureAuth, (req, res) => {
  const statuses = {};
  for (const [id, src] of Object.entries(SOURCES)) {
    statuses[id] = { name: src.name, status: 'online', latency: Math.floor(Math.random()*200+50)+'ms' };
  }
  res.json({ statuses, total: Object.keys(SOURCES).length, active: Object.keys(SOURCES).length, workerConnected: !!workerUrl });
});

// ── POST /api/search — Recherche directe ─────────────────────────────────────
router.post('/search', ensureAuth, async (req, res) => {
  const { query } = req.body;
  const userId   = req.user.id;
  const isVip    = VIP_IDS.has(userId);

  if (!query?.trim()) return res.status(400).json({ error: 'Requête vide.' });

  // Cooldown
  if (!isVip) {
    const last = cooldowns[userId] || 0;
    const remaining = COOLDOWN_MS - (Date.now() - last);
    if (remaining > 0) {
      return res.status(429).json({ error: 'Cooldown actif', remainingMs: remaining, remainingSec: Math.ceil(remaining/1000) });
    }
  }

  // Worker dispo ?
  if (!workerUrl) return res.status(503).json({ error: 'Worker Python non connecté. Lance start.bat sur ton PC.' });

  const job_id = genId();

  // Cooldown + leaderboard
  if (!isVip) cooldowns[userId] = Date.now();
  if (!leaderboard[userId]) leaderboard[userId] = { username: req.user.username, count: 0, last: null };
  leaderboard[userId].count++;
  leaderboard[userId].last = new Date().toISOString();

  // Envoyer au worker et attendre le résultat (timeout 60s)
  try {
    // On envoie le job au worker
    await axios.post(`${workerUrl}/search`, { job_id, query: query.trim() }, {
      headers: { 'X-Worker-Secret': workerSecret }, timeout: 8000
    });

    // Attendre le résultat (polling interne max 60s)
    let result = null;
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (jobResults[job_id]) { result = jobResults[job_id]; break; }
    }

    if (!result) return res.status(504).json({ error: 'Timeout — la recherche a pris trop longtemps.' });

    // Supprimer le résultat du cache
    delete jobResults[job_id];

    res.json({
      query:   query.trim(),
      sources: result.sources || result.results || [],
      count:   result.count   || 0,
      error:   result.error   || null,
    });

  } catch(err) {
    console.error('[Search]', err.message);
    res.status(500).json({ error: 'Erreur worker: ' + err.message });
  }
});

// ── GET /api/leaderboard ──────────────────────────────────────────────────────
router.get('/leaderboard', ensureAuth, (req, res) => {
  const userId = req.user.id;
  const board = Object.entries(leaderboard)
    .map(([uid, d]) => ({
      displayName: uid === OWNER_ID ? `👑 ${d.username}` : 'Anonyme',
      isYou: uid === userId, isOwner: uid === OWNER_ID,
      count: d.count, last: d.last
    }))
    .sort((a,b) => b.count - a.count).slice(0,20);
  res.json({ leaderboard: board });
});

// ── POST /api/worker/register ─────────────────────────────────────────────────
router.post('/worker/register', (req, res) => {
  if (req.headers['x-worker-secret'] !== workerSecret) return res.status(401).json({ error: 'Unauthorized' });
  workerUrl = req.body.worker_url;
  console.log(`[Worker] Connecté: ${workerUrl}`);
  res.json({ status: 'registered' });
});

// ── POST /api/worker/result ───────────────────────────────────────────────────
router.post('/worker/result', (req, res) => {
  if (req.headers['x-worker-secret'] !== workerSecret) return res.status(401).json({ error: 'Unauthorized' });
  const { job_id, results, sources, count, error } = req.body;
  jobResults[job_id] = { results: results||[], sources: sources||results||[], count: count||0, error: error||null };
  console.log(`[Worker] Résultat reçu job ${job_id} — ${count} résultats`);
  res.json({ status: 'ok' });
});

// ── GET /api/worker/status ────────────────────────────────────────────────────
router.get('/worker/status', ensureAuth, (req, res) => {
  res.json({ connected: !!workerUrl });
});

module.exports = router;

// ── POST /api/searcher ────────────────────────────────────────────────────────
router.post('/searcher', ensureAuth, async (req, res) => {
  const { query, quickSearch, criteria, wildcard } = req.body;
  const userId = req.user.id;
  const isVip  = VIP_IDS.has(userId);

  if (!query?.trim()) return res.status(400).json({ error: 'Requête vide.' });
  if (!workerUrl) return res.status(503).json({ error: 'Worker non connecté.' });

  const job_id = genId();

  if (!isVip) cooldowns[userId] = Date.now();
  if (!leaderboard[userId]) leaderboard[userId] = { username: req.user.username, count: 0, last: null };
  leaderboard[userId].count++;
  leaderboard[userId].last = new Date().toISOString();

  try {
    await axios.post(`${workerUrl}/searcher`, {
      job_id, query: query.trim(), quickSearch: quickSearch||'', criteria: criteria||[], wildcard: !!wildcard
    }, { headers: { 'X-Worker-Secret': workerSecret }, timeout: 8000 });

    // Wait for result
    let result = null;
    for (let i = 0; i < 200; i++) {
      await new Promise(r => setTimeout(r, 1000));
      if (jobResults[job_id]) { result = jobResults[job_id]; break; }
    }
    if (!result) return res.status(504).json({ error: 'Timeout.' });
    delete jobResults[job_id];
    res.json({ query: query.trim(), sources: result.sources||[], count: result.count||0, error: result.error||null });
  } catch(err) {
    res.status(500).json({ error: 'Erreur: ' + err.message });
  }
});
