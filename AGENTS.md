# Ayncor E2E — AGENTS.md

Defines rules for system-level verification.

---

# 1. Purpose

This repo validates:

- identity-service
- core-service
- realtime-gateway

It is the **system correctness layer**.

---

# 2. Testing Scope

Must test:

- auth flow
- org isolation
- channel + thread lifecycle
- message creation + versioning
- reactions
- thread states
- inbox behavior
- realtime delivery

---

# 3. Hard Boundaries

Do NOT:

- call internal service functions
- bypass APIs
- mock backend logic
- embed business logic

Always test as a real client.

---

# 4. Contracts

- Tests must align with contracts
- No assumptions beyond contracts
- If contract changes:
  - update tests explicitly
  - explain changes

---

# 5. Environment Rules

- Prefer staging
- Do not run destructive tests on production
- Use environment variables only
- Local/dev default credentials are allowed but must be overrideable via env (never use real production credentials)

---

# 6. Test Design Rules

- No flaky tests
- Avoid fixed sleeps
- Use retries with limits
- Ensure isolation of test data

---

# 7. Realtime Testing

- WebSocket events must be verified
- Allow eventual delivery (not instant)
- Validate fallback via REST

---

# 8. Logging & Debugging

- Use `e2e/logger.ts` for harness logging (avoid raw `console.*`)
- Keep default CI output clean; only print step breadcrumbs when `E2E_VERBOSE=1`
- Log test flow clearly when verbose/debug is enabled
- Capture failures with context
- Do not log secrets

---

# 9. CI Integration

- Intended to run after staging deploy (or in a dedicated E2E environment)
- Intended to gate promotions when CI is wired (do not weaken skip logic silently)

---

# 10. Things That Must Never Happen

- Tests coupled to implementation
- Real production credentials or secrets in code/logs
- Silent test failures
- Skipping critical flows

---

# 11. Philosophy

Test reality, not assumptions  
Fail loudly, not silently  
System correctness > coverage %

This repo is the final safety net before production.
