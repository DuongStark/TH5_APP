import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import { initialNotifications } from '../data/demo';
import type {
  ChatNotification,
  Contact,
  Conversation,
  Message,
} from '../types';
import {
  ensureProfile,
  errorMessage,
  login,
  logout,
  watchSession,
} from '../services/auth';
import {
  markMessagesRead,
  sendChatMessage,
  watchContacts,
  watchConversations,
} from '../services/chat';
import { startPresence } from '../services/presence';

type ChatState = {
  username: string | null;
  email: string;
  loading: boolean;
  dataLoading: boolean;
  error: string;
  contacts: Contact[];
  conversations: Conversation[];
  notifications: ChatNotification[];
  showOnline: boolean;
  notificationsEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendMessage: (
    contactId: string,
    text: string,
    coordinates?: { latitude: number; longitude: number },
  ) => Promise<void>;
  markRead: (contactId: string, messages: Message[]) => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setShowOnline: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
};
const ChatContext = createContext<ChatState | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  // Chỉ phiên đăng nhập nằm trong AsyncStorage. Tin nhắn lưu trên Firebase.
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [showOnline, setShowOnline] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const visibility = useRef(true);
  const presence = useRef<ReturnType<typeof startPresence> | null>(null);

  useEffect(
    () =>
      watchSession(value => {
        setUser(value);
        setContacts([]);
        setConversations([]);
        setError('');
        setShowOnline(true);
        visibility.current = true;
        setNotificationsEnabled(true);
        setNotifications(initialNotifications);
        setLoading(false);
        setDataLoading(!!value);
      }),
    [],
  );

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    let stopContacts = () => {};
    let stopChats = () => {};
    const report = (reason: Error) => {
      if (active) {
        setError(errorMessage(reason));
        setDataLoading(false);
      }
    };
    ensureProfile(user)
      .then(() => {
        if (!active) {
          return;
        }
        stopContacts = watchContacts(
          user.uid,
          list => {
            if (active) {
              setContacts(list);
              setDataLoading(false);
            }
          },
          report,
        );
        stopChats = watchConversations(
          user.uid,
          list => {
            if (active) {
              setConversations(list);
            }
          },
          report,
        );
        presence.current = startPresence(user.uid, report, visibility.current);
      })
      .catch(report);
    // Quan trọng: gỡ listener trước khi đổi tài khoản hoặc unmount.
    return () => {
      active = false;
      stopContacts();
      stopChats();
      const previous = presence.current;
      presence.current = null;
      previous?.stop().catch(() => {});
    };
  }, [user]);

  async function signOut() {
    // Xóa trạng thái online trước khi Firebase thu hồi phiên hiện tại.
    await presence.current?.stop();
    presence.current = null;
    await logout();
  }

  function requireUid() {
    if (!user) {
      throw new Error('Vui lòng đăng nhập lại.');
    }
    return user.uid;
  }

  return (
    <ChatContext.Provider
      value={{
        username: user
          ? user.displayName || user.email?.split('@')[0] || 'Người dùng'
          : null,
        email: user?.email ?? '',
        loading,
        dataLoading,
        error,
        contacts,
        conversations,
        notifications,
        showOnline,
        notificationsEnabled,
        signIn: login,
        signOut,
        sendMessage: (peer, text, coordinates) =>
          sendChatMessage(requireUid(), peer, text, coordinates),
        markRead: (peer, messages) =>
          markMessagesRead(requireUid(), peer, messages),
        markNotificationRead: id =>
          setNotifications(current =>
            current.map(notice =>
              notice.id === id ? { ...notice, read: true } : notice,
            ),
          ),
        markAllNotificationsRead: () =>
          setNotifications(current =>
            current.map(notice => ({ ...notice, read: true })),
          ),
        setShowOnline: value => {
          visibility.current = value;
          setShowOnline(value);
          presence.current?.setVisible(value);
        },
        setNotificationsEnabled,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat requires ChatProvider');
  }
  return context;
}
