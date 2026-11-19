import { inspectFixture, names, rootFor } from './fixtures.js';

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const cookieName = 'yarn_demo';
const queueTimeoutMs = 120_000;
const retentionMs = 86_400_000;

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function sessionFor(request) {
  const value = request.headers.get('Cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
  return uuid.test(value ?? '') ? value : null;
}

function job(row) {
  const messages = {
    queued: 'Queued in Cloudflare Queues. Checking the synthetic example…',
    completed: 'Synthetic recheck complete. Results saved in D1.',
    failed: 'The synthetic recheck did not finish. Please try again.'
  };
  return {
    id: row.id, root: rootFor(row.fixture),
    status: row.status === 'queued' ? 'running' : row.status,
    message: messages[row.status],
    snapshot: row.status === 'completed' ? row.id : null
  };
}

function effectiveStatus(row) {
  return row.status === 'queued' && row.created_ms < Date.now() - queueTimeoutMs
    ? { ...row, status: 'failed' } : row;
}

async function state(env, url, existingSession) {
  const session = existingSession ?? crypto.randomUUID();
  const { results } = await env.DB.prepare(
    'SELECT * FROM runs WHERE session = ? AND created_ms > ? ORDER BY created_ms DESC, id DESC LIMIT 24'
  ).bind(session, Date.now() - retentionMs).all();
  const history = names.map(name => inspectFixture(name, 'example-' + name, null));
  for (const row of [...results].reverse()) {
    if (row.status === 'completed') history.push(JSON.parse(row.result));
  }
  const headers = existingSession ? {} : {
    'Set-Cookie': `${cookieName}=${session}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${url.protocol === 'https:' ? '; Secure' : ''}`
  };
  return json({
    token: session, roots: names.map(rootFor), history, demoMode: true, codexConnected: false,
    cloudflareDemo: true, jobs: results.map(effectiveStatus).map(job)
  }, 200, headers);
}

async function start(request, env, url, session) {
  if (!session || request.headers.get('Origin') !== url.origin ||
      request.headers.get('X-Security-Token') !== session) {
    return json({ error: 'Open the demo before starting a recheck.' }, 403);
  }
  // The demo accepts only a tiny selector request, never a folder, file or report.
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let data;
  try {
    if (!reader) throw Error('Missing request body');
    let size = 0;
    let body = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return json({ error: 'Recheck request is too large.' }, 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    data = JSON.parse(body + decoder.decode());
  } catch {
    return json({ error: 'Invalid recheck request.' }, 400);
  } finally {
    reader?.releaseLock();
  }
  const fixture = names.find(name => rootFor(name) === data?.path);
  if (!fixture || data.includeCodex || data.allowAdvisoryLookup) {
    return json({ error: 'Only bundled synthetic examples can be checked.' }, 403);
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  const row = { id, fixture, status: 'queued', created_ms: now };
  const [, , inserted] = await env.DB.batch([
    env.DB.prepare('DELETE FROM runs WHERE created_ms < ?').bind(now - retentionMs),
    env.DB.prepare("UPDATE runs SET status = 'failed' WHERE session = ? AND status = 'queued' AND created_ms < ?")
      .bind(session, now - queueTimeoutMs),
    env.DB.prepare("INSERT OR IGNORE INTO runs (id, session, fixture, created_ms, status) VALUES (?, ?, ?, ?, 'queued')")
      .bind(id, session, fixture, now)
  ]);
  if (!inserted.meta.changes) {
    const previous = await env.DB.prepare(
      "SELECT * FROM runs WHERE session = ? AND fixture = ? ORDER BY created_ms DESC, id DESC LIMIT 1"
    ).bind(session, fixture).first();
    return json(job(previous), 202);
  }
  try {
    await env.RECHECKS.send({ id });
  } catch (error) {
    console.error('Recheck dispatch failed', error);
    await env.DB.prepare("UPDATE runs SET status = 'failed' WHERE id = ? AND status = 'queued'").bind(id).run();
    return json({ error: 'Could not queue the synthetic recheck. Please try again.' }, 503);
  }
  return json(job(row), 202);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const session = sessionFor(request);
    if (request.method === 'GET' && url.pathname === '/api/state') return state(env, url, session);
    if (request.method === 'POST' && url.pathname === '/api/check') return start(request, env, url, session);
    if (request.method === 'GET' && url.pathname === '/api/run') {
      const id = url.searchParams.get('id');
      if (session && uuid.test(id ?? '')) {
        const row = await env.DB.prepare('SELECT * FROM runs WHERE id = ? AND session = ? AND created_ms > ?')
          .bind(id, session, Date.now() - retentionMs).first();
        if (row) return json(job(effectiveStatus(row)));
      }
    }
    return json({ error: 'This endpoint is unavailable in the synthetic demo.' }, 404);
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const id = message.body?.id;
        if (uuid.test(id ?? '')) {
          const row = await env.DB.prepare("SELECT fixture FROM runs WHERE id = ? AND status = 'queued'").bind(id).first();
          if (row) {
            const result = inspectFixture(row.fixture, id, new Date().toISOString());
            await env.DB.prepare("UPDATE runs SET status = 'completed', result = ? WHERE id = ? AND status = 'queued'")
              .bind(JSON.stringify(result), id).run();
          }
        }
        message.ack();
      } catch (error) {
        console.error('Synthetic recheck failed', error);
        message.retry();
      }
    }
  }
};
