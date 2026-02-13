# Context-Drift (Standalone)

A lightweight dashboard for monitoring OpenClaw **context pressure** and **estimated cost** per session.

> Note: We later integrated the core drift metrics into `monitor-dashboard`. This repo remains useful as a standalone “sidecar” reference implementation.

## Run

```bash
cd context-drift
npm install

# set env (recommended)
cp .env.example .env

node server.js
```

Open:
- http://localhost:18790

## Configuration

Required:
- `OPENCLAW_GATEWAY_HTTP_URL` (example: `http://127.0.0.1:18789`)
- `OPENCLAW_GATEWAY_TOKEN`

Optional:
- `PORT` (default `18790`)
- `CONTEXT_DRIFT_CORS_ORIGINS` (comma-separated) to allow cross-origin access.

## Security / OPSEC

- Designed for **localhost** usage.
- Treat the gateway token like a password.
- No token-in-URL patterns.
- The server sends basic hardening headers (CSP, XFO, nosniff, no-referrer, permissions-policy).

## Pricing

Edit `config/pricing.json` to tune per-model costs.

## License

MIT (see `LICENSE`).
