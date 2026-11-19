const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const origin = process.argv[2] || 'http://127.0.0.1:8789';

async function main() {
  const js = await fetch(origin + '/dictionary.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /javascript/);
  const words = await fetch(origin + '/dictionary.json');
  assert.equal(words.status, 200);
  assert.equal((await words.json()).length, 93);

  const initialResponse = await fetch(origin + '/api/state');
  assert.equal(initialResponse.status, 200);
  const cookie = initialResponse.headers.get('set-cookie').split(';')[0];
  const initial = await initialResponse.json();
  assert.equal(initial.demoMode, true);
  assert.deepEqual(initial.roots, ['/synthetic/clean', '/synthetic/review']);
  const headers = { Cookie: cookie };
  const postHeaders = {
    ...headers, Origin: origin, 'Content-Type': 'application/json', 'X-Security-Token': initial.token
  };
  const start = (body, requestHeaders = postHeaders) => fetch(origin + '/api/check', {
    method: 'POST', headers: requestHeaders, body: JSON.stringify(body)
  });

  assert.equal((await start({ path: '/outside-demo' })).status, 403);
  assert.equal((await start({ path: '/synthetic/review', includeCodex: true })).status, 403);
  assert.equal((await start({ path: '/synthetic/review', allowAdvisoryLookup: true })).status, 403);
  assert.equal((await start({ path: '/synthetic/review' }, { ...postHeaders, Origin: 'https://example.invalid' })).status, 403);

  for (const [fixture, findingCount] of [['review', 3], ['clean', 0]]) {
    const requested = await start({ path: '/synthetic/' + fixture });
    assert.equal(requested.status, 202);
    let run = await requested.json();
    assert.equal(run.status, 'running');
    assert.match(run.message, /Cloudflare Queues/);

    const statusUrl = origin + '/api/run?id=' + run.id;
    assert.equal((await fetch(statusUrl)).status, 404);
    for (let attempt = 0; attempt < 40 && run.status === 'running'; attempt++) {
      await delay(250);
      const response = await fetch(statusUrl, { headers });
      assert.equal(response.status, 200);
      run = await response.json();
    }
    assert.equal(run.status, 'completed');
    assert.match(run.message, /saved in D1/);
    const refreshed = await (await fetch(origin + '/api/state', { headers })).json();
    const snapshot = refreshed.history.find(item => item.id === run.snapshot);
    assert.equal(snapshot.synthetic, true);
    assert.equal(snapshot.root, '/synthetic/' + fixture);
    assert.equal(snapshot.findings.length, findingCount);
  }
  console.log('Passed: Dictionary assets, Queue delivery, both synthetic checks, D1 results, session isolation, and request boundaries.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
