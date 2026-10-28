/* Kiểm tra SDK thật với Emulator, không dùng dữ liệu chat giả. */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { initializeApp, deleteApp } = require('firebase/app');
const {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} = require('firebase/auth');
const {
  getDatabase,
  connectDatabaseEmulator,
  ref,
  set,
  get,
  update,
  goOffline,
  serverTimestamp,
} = require('firebase/database');

// Chạy nguyên services TypeScript của app trên Node; chỉ thay module khởi tạo RN
// bằng các Firebase client độc lập để mô phỏng hai thiết bị.
require.extensions['.ts'] = (module, filename) => {
  const result = require('@babel/core').transformFileSync(filename, {
    configFile: false,
    babelrc: false,
    presets: ['module:@react-native/babel-preset'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  });
  module._compile(result.code, filename);
};
function loadServices(auth, database) {
  const filename = path.resolve('src/services/firebase.ts');
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports: { auth, database },
  };
  for (const name of ['chat', 'auth']) {
    delete require.cache[path.resolve(`src/services/${name}.ts`)];
  }
  return {
    ...require('../src/services/chat.ts'),
    ...require('../src/services/auth.ts'),
  };
}
const apps = [];
let rules;
after(async () => {
  apps.forEach(app => goOffline(getDatabase(app)));
  await Promise.all(apps.map(app => deleteApp(app)));
  await rules?.cleanup();
});
function client(name) {
  const app = initializeApp(
    {
      apiKey: 'demo-api-key',
      projectId: 'demo-may-chat',
      databaseURL: 'https://demo-may-chat-default-rtdb.firebaseio.com',
    },
    name,
  );
  apps.push(app);
  const auth = getAuth(app);
  const db = getDatabase(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  return { auth, db, service: loadServices(auth, db) };
}
function waitForSubscription(subscribe, predicate) {
  return new Promise((resolve, reject) => {
    let stop = () => {};
    const timeout = setTimeout(() => {
      stop();
      reject(new Error('Timeout nhận dữ liệu realtime'));
    }, 12000);
    stop = subscribe(value => {
      if (predicate(value)) {
        clearTimeout(timeout);
        stop();
        resolve(value);
      }
    }, reject);
  });
}

test(
  'two authenticated clients exchange text/location, track unread and enforce security',
  { timeout: 90000 },
  async () => {
    try {
      rules = await initializeTestEnvironment({
        projectId: 'demo-may-chat',
        database: {
          host: '127.0.0.1',
          port: 9000,
          rules: fs.readFileSync('database.rules.json', 'utf8'),
        },
      });
      await rules.clearDatabase();
      const alice = client('alice');
      const bob = client('bob');
      const eve = client('eve');
      const suffix = Date.now();
      await alice.service.register(
        'Nguyễn An',
        `alice${suffix}@example.com`,
        '123456',
        '123456',
      );
      await bob.service.register(
        'Trần Bình',
        `bob${suffix}@example.com`,
        '123456',
        '123456',
      );
      await createUserWithEmailAndPassword(
        eve.auth,
        `eve${suffix}@example.com`,
        '123456',
      );
      await set(ref(eve.db, `users/${eve.auth.currentUser.uid}`), {
        name: 'Người ngoài',
      });
      const a = alice.auth.currentUser.uid;
      const b = bob.auth.currentUser.uid;
      const e = eve.auth.currentUser.uid;
      const id = [a, b].sort().join('_');
      await assert.rejects(
        signInWithEmailAndPassword(
          eve.auth,
          `eve${suffix}@example.com`,
          'sai123',
        ),
        /auth\/(invalid-credential|wrong-password)/,
      );

      console.log('Registered three accounts; waiting for contacts');
      const contacts = await waitForSubscription(
        (cb, error) => bob.service.watchContacts(b, cb, error),
        list => list.length === 2,
      );
      assert.equal(
        contacts.some(person => person.id === b),
        false,
      );
      assert.equal(contacts.find(person => person.id === a).name, 'Nguyễn An');
      console.log('Contacts ready; sending first text');
      const received = waitForSubscription(
        (cb, error) => bob.service.watchConversations(b, cb, error),
        list => list[0]?.messages.length === 1,
      );
      await alice.service.sendChatMessage(a, b, '  Xin chào từ máy A  ');
      const incoming = await received;
      assert.equal(incoming[0].unread, 1);
      assert.equal(incoming[0].messages[0].text, 'Xin chào từ máy A');
      assert.equal(incoming[0].messages[0].mine, false);
      await assert.rejects(
        alice.service.sendChatMessage(a, b, '   '),
        /1 đến 2000/,
      );

      const reset = waitForSubscription(
        (cb, error) => bob.service.watchConversations(b, cb, error),
        list => list[0]?.unread === 0,
      );
      await bob.service.markMessagesRead(b, a, incoming[0].messages);
      await reset;
      const reply = waitForSubscription(
        (cb, error) => alice.service.watchConversations(a, cb, error),
        list => list[0]?.messages.length === 2,
      );
      await bob.service.sendChatMessage(b, a, '📍 Vị trí hiện tại', {
        latitude: 21.02851,
        longitude: 105.804817,
      });
      const withLocation = await reply;
      assert.equal(withLocation[0].unread, 1);
      assert.equal(withLocation[0].messages[1].type, 'location');
      assert.equal(withLocation[0].messages[1].latitude, 21.02851);
      // Tin đến trong lúc đánh dấu snapshot cũ vẫn phải chưa đọc.
      await alice.service.sendChatMessage(a, b, 'Tin đến sau');
      await bob.service.markMessagesRead(b, a, incoming[0].messages);
      const concurrent = await waitForSubscription(
        (cb, error) => bob.service.watchConversations(b, cb, error),
        list => list[0]?.messages.length === 3,
      );
      assert.equal(concurrent[0].unread, 1);

      await assertFails(get(ref(eve.db, `chats/${id}`)));
      await assertFails(
        set(ref(eve.db, `chats/${id}/messages/forged`), {
          senderId: e,
          type: 'text',
          text: 'x',
          createdAt: serverTimestamp(),
        }),
      );
      await assertFails(
        set(ref(alice.db, `chats/${id}/messages/impersonation`), {
          senderId: b,
          type: 'text',
          text: 'x',
          createdAt: serverTimestamp(),
        }),
      );
      await assertFails(
        set(ref(alice.db, `chats/${id}/messages/blank`), {
          senderId: a,
          type: 'text',
          text: '  \n ',
          createdAt: serverTimestamp(),
        }),
      );
      await assertFails(
        set(ref(alice.db, `chats/${id}/messages/bad-location`), {
          senderId: a,
          type: 'location',
          text: 'GPS',
          latitude: 100,
          longitude: 105,
          createdAt: serverTimestamp(),
        }),
      );
      const firstId = incoming[0].messages[0].id;
      await assertFails(
        update(ref(alice.db, `chats/${id}/messages/${firstId}`), {
          text: 'Đã sửa',
        }),
      );
      await assertFails(
        set(ref(alice.db, `chats/${id}/receipts/${b}/${firstId}`), true),
      );
      await assertFails(set(ref(eve.db, `userChats/${b}/fake`), e));
      await assertFails(set(ref(eve.db, `users/${a}/name`), 'Đổi tên hộ'));
      await assertFails(
        set(ref(eve.db, `presence/${a}/connections/fake`), true),
      );
      await assertSucceeds(
        set(ref(alice.db, `presence/${a}/connections/one`), true),
      );
      const online = await waitForSubscription(
        (cb, error) => bob.service.watchContacts(b, cb, error),
        list => list.find(person => person.id === a)?.online,
      );
      assert.equal(online.find(person => person.id === a).online, true);
      await set(ref(alice.db, `presence/${a}/connections/one`), null);
      const offline = await waitForSubscription(
        (cb, error) => bob.service.watchContacts(b, cb, error),
        list => list.find(person => person.id === a)?.online === false,
      );
      assert.equal(offline.find(person => person.id === a).online, false);

      // Cleanup gỡ listener: callback không còn chạy sau khi unsubscribe.
      let deliveries = 0;
      const stop = bob.service.watchConversations(
        b,
        () => {
          deliveries++;
        },
        error => {
          throw error;
        },
      );
      await new Promise(resolve => setTimeout(resolve, 100));
      stop();
      const before = deliveries;
      await alice.service.sendChatMessage(a, b, 'Sau cleanup');
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(deliveries, before);
      await signOut(bob.auth);
      await assertFails(get(ref(bob.db, `chats/${id}`)));
    } catch (error) {
      console.error('INTEGRATION FAILURE:', error);
      throw error;
    }
  },
);
