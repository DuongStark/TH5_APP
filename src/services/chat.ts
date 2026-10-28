import {
  get,
  onValue,
  push,
  ref,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { database } from './firebase';
import { buildConversation, getChatId } from '../utils/chat';
import type { Contact, Conversation, Message, StoredChat } from '../types';

type OnError = (error: Error) => void;

export function watchContacts(
  uid: string,
  callback: (contacts: Contact[]) => void,
  onError: OnError,
) {
  let profiles: Record<string, { name: string }> = {};
  let presence: Record<string, { connections?: Record<string, boolean> }> = {};
  const publish = () =>
    callback(
      Object.entries(profiles)
        .filter(([id]) => id !== uid)
        .map(([id, profile]) => {
          const online = Object.values(presence[id]?.connections ?? {}).some(
            Boolean,
          );
          return {
            id,
            name: profile.name,
            online,
            lastSeen: online ? 'Đang hoạt động' : 'Offline',
          };
        }),
    );
  const stopUsers = onValue(
    ref(database, 'users'),
    snapshot => {
      profiles = snapshot.val() ?? {};
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
    stopUsers();
    stopPresence();
  };
}

// Chỉ nghe các cuộc chat có trong danh sách của tài khoản hiện tại.
export function watchConversations(
  uid: string,
  callback: (conversations: Conversation[]) => void,
  onError: OnError,
) {
  const listeners = new Map<string, () => void>();
  const chats = new Map<string, Conversation>();
  const publish = () =>
    callback(
      [...chats.values()]
        .filter(chat => chat.messages.length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  const stopIndex = onValue(
    ref(database, `userChats/${uid}`),
    snapshot => {
      const index: Record<string, string> = snapshot.val() ?? {};
      listeners.forEach((stop, id) => {
        if (!index[id]) {
          stop();
          listeners.delete(id);
          chats.delete(id);
        }
      });
      Object.entries(index).forEach(([id, peer]) => {
        if (!listeners.has(id)) {
          const stop = onValue(
            ref(database, `chats/${id}`),
            chatSnapshot => {
              chats.set(
                id,
                buildConversation(peer, chatSnapshot.val() ?? {}, uid),
              );
              publish();
            },
            onError,
          );
          listeners.set(id, stop);
        }
      });
      publish();
    },
    onError,
  );
  return () => {
    stopIndex();
    listeners.forEach(stop => stop());
    listeners.clear();
  };
}

async function ensureConversation(uid: string, peer: string) {
  const id = getChatId(uid, peer);
  const membersRef = ref(database, `chats/${id}/members`);
  // Cùng một cặp luôn có cùng members nên hai người tạo đồng thời vẫn an toàn.
  if (!(await get(membersRef)).exists()) {
    const [first, second] = [uid, peer].sort();
    await set(membersRef, { first, second });
  }
  await update(ref(database), {
    [`userChats/${uid}/${id}`]: peer,
    [`userChats/${peer}/${id}`]: uid,
  });
  return id;
}

export async function sendChatMessage(
  uid: string,
  peer: string,
  text: string,
  coordinates?: { latitude: number; longitude: number },
) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000) {
    throw new Error('Tin nhắn cần có từ 1 đến 2000 ký tự.');
  }
  if (
    coordinates &&
    (!Number.isFinite(coordinates.latitude) ||
      !Number.isFinite(coordinates.longitude) ||
      Math.abs(coordinates.latitude) > 90 ||
      Math.abs(coordinates.longitude) > 180)
  ) {
    throw new Error('Tọa độ vị trí không hợp lệ.');
  }
  const id = await ensureConversation(uid, peer);
  const message = push(ref(database, `chats/${id}/messages`));
  await set(message, {
    senderId: uid,
    type: coordinates ? 'location' : 'text',
    text: trimmed,
    createdAt: serverTimestamp(),
    ...coordinates,
  });
}

// Ghi đúng các ID đã nhìn thấy, không đánh dấu nhầm tin đến trong lúc đang ghi.
export async function markMessagesRead(
  uid: string,
  peer: string,
  messages: Message[],
) {
  const changes: Record<string, boolean> = {};
  const id = getChatId(uid, peer);
  messages
    .filter(message => !message.mine)
    .forEach(message => {
      changes[`chats/${id}/receipts/${uid}/${message.id}`] = true;
    });
  if (Object.keys(changes).length) {
    await update(ref(database), changes);
  }
}

export type { StoredChat };
