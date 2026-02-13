# Contributing

## Ground rules
- Do not commit real gateway tokens (`OPENCLAW_GATEWAY_TOKEN`).
- Keep the dashboard **local-first** (no third-party telemetry).
- Prefer small, inspectable dependencies.

## Dev loop

```bash
npm install
node server.js
```

## Release checklist
- `npm run lint` (if added)
- Verify hardening headers in browser devtools
- Verify `.env.example` stays token-empty
