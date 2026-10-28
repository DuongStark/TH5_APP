import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebServer } from '../server.cjs';

test('serves the phone UI and public config, rejects writes and traversal', async () => {
  const server = createWebServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type'), /text\/html/);
    assert.match(await home.text(), /id="chat-screen"/);
    const dual = await fetch(`${base}/dual.html`);
    assert.equal(dual.status, 200);
    const config = await fetch(`${base}/services/firebase-config.json`);
    assert.equal((await config.json()).projectId, 'may-chat-bai5-duongstark');
    assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/%2e%2e%2fpackage.json`)).status, 403);
    assert.equal((await fetch(`${base}/missing`)).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
