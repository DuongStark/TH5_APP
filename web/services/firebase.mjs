import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  initializeAuth,
  browserSessionPersistence,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
  signOut,
  connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  onDisconnect,
  serverTimestamp,
  connectDatabaseEmulator,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js';
import { chatId, validateMessage, mapUrl } from '../core.mjs';

const response = await fetch(
  new URL('./firebase-config.json', import.meta.url),
);
if (!response.ok) {
  throw new Error('Không đọc được cấu hình Firebase.');
}
const config = await response.json();
const requestedInstance =
  new URLSearchParams(location.search).get('instance') || 'single';
const instance = /^[a-z0-9_-]{1,32}$/i.test(requestedInstance)
  ? requestedInstance
  : 'single';
const app = initializeApp(config, `may-web-${instance}`);
// Mỗi tab và mỗi khung điện thoại có phiên riêng, không đăng nhập đè nhau.
const auth = initializeAuth(app, { persistence: browserSessionPersistence });
const database = getDatabase(app);
if (config.useEmulators) {
  const host = config.emulatorHost || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectDatabaseEmulator(database, host, 9000);
}

export const watchSession = callback => onAuthStateChanged(auth, callback);
export const login = (email, password) =>
  signInWithEmailAndPassword(auth, email.trim(), password);
export const logout = () => signOut(auth);

export function errorMessage(error) {
  const code = error?.code;
  const errors = {
    'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
    'auth/wrong-password': 'Email hoặc mật khẩu không đúng.',
    'auth/user-not-found': 'Email hoặc mật khẩu không đúng.',
    'auth/invalid-email': 'Email không hợp lệ.',
    'auth/email-already-in-use': 'Email này đã được đăng ký.',
    'auth/weak-password': 'Mật khẩu phải có ít nhất 6 ký tự.',
    'auth/too-many-requests': 'Thao tác quá nhiều lần. Vui lòng thử lại sau.',
    'auth/network-request-failed':
      'Không thể kết nối Firebase. Kiểm tra mạng và thử lại.',
    'auth/operation-not-allowed':
      'Chưa bật đăng nhập bằng Email/Password trên Firebase.',
    PERMISSION_DENIED: 'Không có quyền truy cập dữ liệu.',
    'permission-denied': 'Không có quyền truy cập dữ liệu.',
  };
  return (
    errors[code] ||
    (!code && error?.message) ||
    'Thao tác thất bại. Vui lòng thử lại.'
  );
}

export async function register(name, email, password, confirmation) {
  if (!name.trim() || name.trim().length > 80) {
    throw new Error('Vui lòng nhập họ tên từ 1 đến 80 ký tự.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('Email không hợp lệ.');
  }
  if (password.length < 6) {
    throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  }
  if (password !== confirmation) {
    throw new Error('Mật khẩu nhập lại không khớp.');
  }
  const { user } = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  try {
    await updateProfile(user, { displayName: name.trim() });
    await set(ref(database, `users/${user.uid}`), { name: name.trim() });
  } catch (error) {
    await deleteUser(user).catch(() => signOut(auth));
    throw error;
  }
}

export async function ensureProfile(user) {
  const profile = ref(database, `users/${user.uid}`);
  if (!(await get(profile)).exists()) {
    await set(profile, {
      name: user.displayName || user.email?.split('@')[0] || 'Người dùng',
    });
  }
}

export function watchContacts(uid, callback, onError) {
  let users = {},
    presence = {},
    active = true;
  const publish = () => {
    if (!active) {
      return;
    }
    callback(
      Object.entries(users)
        .filter(([id]) => id !== uid)
        .map(([id, profile]) => ({
          id,
          name: profile.name,
          online: Object.values(presence[id]?.connections ?? {}).some(Boolean),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    );
  };
  const stopUsers = onValue(
    ref(database, 'users'),
    snapshot => {
      users = snapshot.val() ?? {};
      publish();
    },
    onError,
  );
  const stopPresence = onValue(
    ref(database, 'presence'),
    snapshot => {
      presence = snapshot.val() ?? {};
      publish();
    },
    onError,
  );
  return () => {
    active = false;
    stopUsers();
    stopPresence();
  };
}

export function watchConversations(uid, callback, onError) {
  const listeners = new Map(),
    chats = new Map();
  let active = true;
  const publish = () => {
    if (active) {
      callback(new Map(chats));
    }
  };
  const stopIndex = onValue(
    ref(database, `userChats/${uid}`),
    snapshot => {
      if (!active) {
        return;
      }
      const index = snapshot.val() ?? {};
      listeners.forEach((stop, id) => {
        if (!index[id]) {
          stop();
          listeners.delete(id);
          chats.delete(id);
        }
      });
      Object.entries(index).forEach(([id, peerId]) => {
        if (listeners.has(id)) {
          return;
        }
        const stop = onValue(
          ref(database, `chats/${id}`),
          chatSnapshot => {
            if (!active) {
              return;
            }
            chats.set(id, { ...(chatSnapshot.val() ?? {}), peerId });
            publish();
          },
          onError,
        );
        listeners.set(id, stop);
      });
      publish();
    },
    onError,
  );
  return () => {
    active = false;
    stopIndex();
    listeners.forEach(stop => stop());
    listeners.clear();
  };
}

export async function sendMessage(uid, peer, text, coordinates) {
  const trimmed = validateMessage(text);
  if (coordinates) {
    mapUrl(coordinates.latitude, coordinates.longitude);
  }
  const id = chatId(uid, peer);
  const members = ref(database, `chats/${id}/members`);
  if (!(await get(members)).exists()) {
    const [first, second] = [uid, peer].sort();
    await set(members, { first, second });
  }
  await update(ref(database), {
    [`userChats/${uid}/${id}`]: peer,
    [`userChats/${peer}/${id}`]: uid,
  });
  await set(push(ref(database, `chats/${id}/messages`)), {
    senderId: uid,
    text: trimmed,
    type: coordinates ? 'location' : 'text',
    createdAt: serverTimestamp(),
    ...coordinates,
  });
}

export async function markRead(uid, peer, messageIds) {
  if (!messageIds.length) {
    return;
  }
  const changes = {},
    id = chatId(uid, peer);
  messageIds.forEach(messageId => {
    changes[`chats/${id}/receipts/${uid}/${messageId}`] = true;
  });
  await update(ref(database), changes);
}

export function startPresence(uid, onError) {
  const connection = push(ref(database, `presence/${uid}/connections`));
  let connected = false,
    stopped = false,
    queue = Promise.resolve();
  function refresh() {
    queue = queue
      .then(async () => {
        if (stopped || !connected) {
          return;
        }
        // Vào nền thì offline giống AppState của bản React Native.
        if (document.hidden) {
          await remove(connection);
          return;
        }
        await onDisconnect(connection).remove();
        if (!stopped && connected && !document.hidden) {
          await set(connection, true);
        }
      })
      .catch(onError);
  }
  const stopConnection = onValue(
    ref(database, '.info/connected'),
    snapshot => {
      connected = snapshot.val() === true;
      refresh();
    },
    onError,
  );
  document.addEventListener('visibilitychange', refresh);
  return async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    stopConnection();
    document.removeEventListener('visibilitychange', refresh);
    if (connected) {
      await queue;
      await remove(connection);
      await onDisconnect(connection).cancel();
    }
  };
}
