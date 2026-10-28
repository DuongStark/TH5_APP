import test from 'node:test';
import assert from 'node:assert/strict';

test('fits the phone and shows a readable error if browser SDK cannot load', async () => {
  const ids = new Map();
  const getElementById = id => {
    if (!ids.has(id)) {
      ids.set(id, { hidden: false, disabled: false, textContent: '' });
    }
    return ids.get(id);
  };
  const globals = {
    document: {
      getElementById,
      body: { classList: { toggle() {} } },
      documentElement: { style: { setProperty() {} } },
    },
    window: { addEventListener() {} },
    location: new URL('http://localhost:4173/'),
    innerWidth: 1280,
    innerHeight: 800,
    setInterval() {
      return 0;
    },
  };
  const previous = new Map(
    Object.keys(globals).map(key => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const originalError = console.error;
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  }
  console.error = () => {};
  try {
    // Node không tải module https của browser, mô phỏng việc SDK không tải được.
    await import('../boot.mjs');
    assert.match(getElementById('clock').textContent, /^\d{1,2}:\d{2}$/);
    assert.equal(getElementById('loading-screen').hidden, true);
    assert.equal(getElementById('auth-submit').disabled, true);
    assert.match(
      getElementById('global-error').textContent,
      /Không tải được Firebase/,
    );
  } finally {
    console.error = originalError;
    for (const [key, descriptor] of previous) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globalThis[key];
      }
    }
  }
});
