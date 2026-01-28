/**
 * E2E: identity-service → core-service → realtime-gateway.
 * Prereqs: identity (3001), core (3002), realtime-gateway (3010), Redis.
 * Third test (message → event on WS) also requires relay (core-service: npm run relay).
 */
const IDENTITY_URL = process.env.IDENTITY_URL ?? "http://localhost:3001";
const CORE_URL = process.env.CORE_URL ?? "http://localhost:3002";
const REALTIME_WS_URL = process.env.REALTIME_WS_URL ?? "ws://localhost:3010";

const TEST_USER = {
  email: process.env.E2E_EMAIL ?? "admin@ayncor.local",
  password: process.env.E2E_PASSWORD ?? "ayncor@123",
  org_slug: process.env.E2E_ORG_SLUG ?? "ayncor"
};

async function login(): Promise<{ access_token: string; org_id: string }> {
  const res = await fetch(`${IDENTITY_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
      org_slug: TEST_USER.org_slug
    })
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; org: { id: string } };
  return { access_token: data.access_token, org_id: data.org.id };
}

async function coreFetch(path: string, token: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${CORE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
}

describe("E2E full stack", () => {
  it("login → channel → thread → message", async () => {
    const { access_token, org_id } = await login();
    expect(access_token).toBeTruthy();
    expect(org_id).toBeTruthy();

    const slug = `e2e-${Date.now()}`;
    const channelRes = await coreFetch("/channels", access_token, {
      method: "POST",
      body: JSON.stringify({ name: "E2E Channel", slug, visibility: "ORG" })
    });
    expect(channelRes.ok).toBe(true);
    const channel = (await channelRes.json()) as { channel: { id: string } };
    const channelId = channel.channel.id;

    const threadRes = await coreFetch("/threads", access_token, {
      method: "POST",
      body: JSON.stringify({ channel_id: channelId, title: "E2E Thread", purpose: "E2E test" })
    });
    expect(threadRes.ok).toBe(true);
    const thread = (await threadRes.json()) as { thread: { id: string } };
    const threadId = thread.thread.id;

    const messageRes = await coreFetch("/messages", access_token, {
      method: "POST",
      body: JSON.stringify({ thread_id: threadId, body: "Hello E2E!", requires_response: true })
    });
    expect(messageRes.ok).toBe(true);
    const message = (await messageRes.json()) as { message: { id: string } };
    expect(message.message.id).toBeTruthy();

    const listRes = await coreFetch(`/messages/thread/${threadId}`, access_token);
    expect(listRes.ok).toBe(true);
    const list = (await listRes.json()) as { messages: unknown[] };
    expect(list.messages.length).toBeGreaterThanOrEqual(1);
  });

  it("realtime-gateway: connect with token and subscribe to inbox", async () => {
    const { access_token, org_id } = await login();
    const WebSocket = (await import("ws")).default;
    const ws = new WebSocket(`${REALTIME_WS_URL}?access_token=${access_token}`);

    const subscribed = new Promise<{ type: string }>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "subscribe",
            request_id: "e2e-1",
            payload: { org_id, topic: "inbox" }
          })
        );
      });
      ws.on("message", (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type: string };
          if (msg.type === "error") reject(new Error("Gateway sent error"));
          if (msg.type === "subscribed") resolve(msg);
        } catch {
          reject(new Error("Invalid JSON"));
        }
      });
      ws.on("error", reject);
    });

    const msg = await subscribed;
    expect(msg.type).toBe("subscribed");
    ws.close();
  });

  it("message created via core → event received on WebSocket (relay running)", async () => {
    const { access_token, org_id } = await login();
    const slug = `e2e-ws-${Date.now()}`;
    const channelRes = await coreFetch("/channels", access_token, {
      method: "POST",
      body: JSON.stringify({ name: "E2E WS Channel", slug, visibility: "ORG" })
    });
    expect(channelRes.ok).toBe(true);
    const channel = (await channelRes.json()) as { channel: { id: string } };
    const channelId = channel.channel.id;

    const threadRes = await coreFetch("/threads", access_token, {
      method: "POST",
      body: JSON.stringify({ channel_id: channelId, title: "E2E WS Thread", purpose: "E2E event test" })
    });
    expect(threadRes.ok).toBe(true);
    const thread = (await threadRes.json()) as { thread: { id: string } };
    const threadId = thread.thread.id;

    const WebSocket = (await import("ws")).default;
    const ws = new WebSocket(`${REALTIME_WS_URL}?access_token=${access_token}`);

    const subscribed = new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "subscribe",
            request_id: "e2e-ws-1",
            payload: { org_id, topic: "inbox" }
          })
        );
      });
      ws.on("message", (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString()) as { type: string };
          if (msg.type === "error") reject(new Error("Gateway sent error"));
          if (msg.type === "subscribed") resolve();
        } catch {
          reject(new Error("Invalid JSON"));
        }
      });
      ws.on("error", reject);
    });
    await subscribed;

    const eventReceived = new Promise<{ type: string; payload?: { envelope?: { event_type?: string; payload?: { thread_id?: string } } } }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.removeAllListeners("message");
          reject(new Error("Timeout waiting for Core.MessageCreated event (is relay running? core-service: npm run relay)"));
        }, 10000);
        ws.on("message", (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString()) as {
              type: string;
              payload?: { envelope?: { event_type?: string; payload?: { thread_id?: string } } };
            };
            if (msg.type === "event" && msg.payload?.envelope?.event_type === "Core.MessageCreated" && msg.payload.envelope.payload?.thread_id === threadId) {
              clearTimeout(timeout);
              resolve(msg);
            }
          } catch {
            // ignore non-JSON or unexpected shape
          }
        });
      }
    );

    const messageRes = await coreFetch("/messages", access_token, {
      method: "POST",
      body: JSON.stringify({ thread_id: threadId, body: "E2E event test message", requires_response: false })
    });
    expect(messageRes.ok).toBe(true);

    const event = await eventReceived;
    expect(event.type).toBe("event");
    expect(event.payload?.envelope?.event_type).toBe("Core.MessageCreated");
    expect(event.payload?.envelope?.payload?.thread_id).toBe(threadId);
    ws.close();
  });
});
