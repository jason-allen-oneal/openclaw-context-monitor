const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 18790);

// Config (NO secrets in code)
const GATEWAY_HTTP_URL = process.env.OPENCLAW_GATEWAY_HTTP_URL || 'http://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const PRICING_PATH = path.join(__dirname, 'config', 'pricing.json');

const corsOrigins = (process.env.CONTEXT_DRIFT_CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function hardenHeaders(req, res, next) {
  // Localhost-focused hardening.
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('cross-origin-opener-policy', 'same-origin');
  res.setHeader('cross-origin-resource-policy', 'same-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'content-security-policy',
    "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self';"
  );
  next();
}

app.use(hardenHeaders);
app.use(express.json({ limit: '256kb' }));

// CORS is OFF by default. Enable only when needed.
if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins, credentials: false }));
}

app.use(express.static(path.join(__dirname, 'public')));

let selectedSessionKey = null;
let latestMetrics = {
  timestamp: Date.now(),
  session: null,
  pricing: null,
  cost: 0,
  pressure: 0,
  sessions: []
};

function getPricing() {
  try {
    const data = fs.readFileSync(PRICING_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading pricing.json:', err);
    return null;
  }
}

async function gatewayInvoke(tool, args) {
  if (!GATEWAY_TOKEN) {
    throw new Error('Missing OPENCLAW_GATEWAY_TOKEN (refusing to call gateway).');
  }

  const response = await fetch(`${GATEWAY_HTTP_URL}/tools/invoke`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GATEWAY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tool, args })
  });

  const data = await response.json();
  if (!data.ok) throw new Error(data.error?.message || 'Gateway error');
  return data.result.details;
}

async function fetchMetrics() {
  try {
    const details = await gatewayInvoke('sessions_list', { limit: 50 });

    const sessions = details.sessions;
    if (!sessions || sessions.length === 0) return;

    // Default to first session if none selected or selected session gone
    const session = sessions.find((s) => s.key === selectedSessionKey) || sessions[0];
    const pricing = getPricing();

    let cost = 0;
    if (pricing) {
      const modelPrice = pricing.models?.[session.model] || pricing.default;
      if (modelPrice) {
        // Rough estimate: we don't have per-turn I/O, so assume 80/20 split.
        const inputTokens = session.totalTokens * 0.8;
        const outputTokens = session.totalTokens * 0.2;
        cost = (inputTokens / 1000) * (modelPrice.input || 0) + (outputTokens / 1000) * (modelPrice.output || 0);
      }
    }

    const pressure = session.contextTokens ? (session.totalTokens / session.contextTokens) * 100 : 0;

    latestMetrics = {
      timestamp: Date.now(),
      session: {
        id: session.sessionId,
        key: session.key,
        model: session.model,
        totalTokens: session.totalTokens,
        contextTokens: session.contextTokens,
        updatedAt: session.updatedAt
      },
      pricing: pricing?.models?.[session.model] || pricing?.default,
      cost: Number(cost.toFixed(4)),
      pressure: Number(pressure.toFixed(2)),
      sessions: sessions.map((s) => ({ key: s.key, label: s.displayName || s.key }))
    };
  } catch (err) {
    // Keep server alive; metrics will show last known values.
    console.error('Error fetching metrics:', err.message);
  }
}

// Poll every 15 seconds
setInterval(fetchMetrics, 15000);
fetchMetrics();

app.get('/api/metrics', (req, res) => {
  res.json(latestMetrics);
});

app.post('/api/select', (req, res) => {
  const { key } = req.body || {};
  if (typeof key === 'string' && key.trim()) {
    selectedSessionKey = key.trim();
    void fetchMetrics();
    return res.json({ ok: true, selected: selectedSessionKey });
  }
  res.status(400).json({ ok: false, error: 'Missing key' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Context-Drift server running on http://127.0.0.1:${PORT}`);
});
