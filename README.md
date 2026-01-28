# ayncor-e2e

Cross-repo E2E tests for **identity-service**, **core-service**, and **realtime-gateway**. This repo is the fourth repo: it does not own any service; it runs tests against the three services when they are running (locally or in CI).

## Role

- **Orchestration**: Document or provide a way to run identity, core, realtime-gateway (and Redis, relay) together for E2E.
- **E2E suite**: Jest tests that call identity (login), core (channel, thread, message), and realtime-gateway (WebSocket connect + subscribe).
- **CI**: This repo’s pipeline can run E2E after the three services are available (e.g. from published images or from source).

## Prerequisites

Before running E2E, the following must be running:

- **identity-service** (e.g. `http://localhost:3001`)
- **core-service** (e.g. `http://localhost:3002`)
- **realtime-gateway** (e.g. `ws://localhost:3010`)
- **Redis** (used by realtime-gateway; relay and core-service if testing event flow)

For the **message → WebSocket event** test: **relay** (core-service outbox → Redis). Start it from core-service: `npm run relay`.

## Steps to run E2E

1. **Start databases and Redis** (from each service repo):
   - identity-service: `cd identity-service && docker compose up -d` (Postgres for identity)
   - core-service: `cd core-service && docker compose up -d` (Postgres for core)
   - realtime-gateway: `cd realtime-gateway && docker compose up -d` (Redis)

2. **Start the three services** (each in its own terminal, from its repo):
   - identity-service: `cd identity-service && npm run start:dev` (port 3001)
   - core-service: `cd core-service && npm run start:dev` (port 3002)
   - realtime-gateway: `cd realtime-gateway && npm run start:dev` (port 3010)

3. **Start relay** (for the “message → event on WebSocket” test; from core-service repo):
   - `cd core-service && npm run relay` (polls outbox, publishes to Redis; needs same DATABASE_URL and REDIS_URL as core)

4. **Optional sanity checks** (services up and reachable):
   - `Invoke-RestMethod http://localhost:3001/health -UseBasicParsing` (identity)
   - `Invoke-RestMethod http://localhost:3002/health -UseBasicParsing` (core)
   - `Invoke-RestMethod http://localhost:3010/health/ready -UseBasicParsing` (realtime-gateway + Redis)

5. **Run E2E** (from this repo):
   ```bash
   cd ayncor-e2e
   npm install
   npm test
   ```

Ensure the E2E login user exists in identity-service (e.g. `admin@ayncor.local` / `ayncor@123` / org `ayncor` from seed or your setup). Copy `.env.example` to `.env` and adjust URLs or credentials if needed.

## Run E2E (short)

From this repo (with identity, core, realtime-gateway, and Redis already running):

```bash
npm install
npm test
```

Tests expect default base URLs and a bootstrap user. Override with env:

- `IDENTITY_URL` – identity-service base URL (default `http://localhost:3001`)
- `CORE_URL` – core-service base URL (default `http://localhost:3002`)
- `REALTIME_WS_URL` – realtime-gateway WebSocket URL (default `ws://localhost:3010`)
- `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_ORG_SLUG` – login user (default `admin@ayncor.local` / `ayncor@123` / `ayncor`)

## Tests

- **login → channel → thread → message**: Logs in to identity, creates channel/thread/message via core, lists messages.
- **realtime-gateway: connect with token and subscribe to inbox**: Connects to realtime-gateway with JWT, subscribes to inbox, asserts `subscribed` frame.
- **message created via core → event received on WebSocket (relay running)**: Subscribes to inbox over WebSocket, creates a message via core; asserts receipt of a `Core.MessageCreated` event for that thread. Requires relay running (`cd core-service && npm run relay`).

## Repo layout

- `e2e/` – E2E specs (Jest)
- `package.json` – Node + Jest + ws
- `jest.config.js` – test match `e2e/**/*.test.ts`, timeout 30s
