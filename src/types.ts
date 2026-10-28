import type { ImageSourcePropType } from 'react-native';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type Contact = {
  id: string;
  name: string;
  avatar?: ImageSourcePropType;
  online: boolean;
  lastSeen: string;
};

export type StoredMessage = {
  senderId: string;
  type: 'text' | 'location';
  text: string;
  createdAt: number;
  latitude?: number;
  longitude?: number;
};

export type StoredChat = {
  members?: { first: string; second: string };
  messages?: Record<string, StoredMessage>;
  receipts?: Record<string, Record<string, boolean>>;
};

export type Message = StoredMessage & {
  id: string;
  text: string;
  time: string;
  mine: boolean;
};

export type Conversation = {
  contactId: string;
  unread: number;
  messages: Message[];
  updatedAt: number;
};

export type ChatNotification = {
  id: string;
  contactId?: string;
  title: string;
  content: string;
  time: string;
  read: boolean;
};

export type TabParams = {
  Home: undefined;
  Contacts: undefined;
  Notifications: undefined;
  Settings: undefined;
};

export type RootStackParams = {
  Login: undefined;
  Register: undefined;
  Main: NavigatorScreenParams<TabParams> | undefined;
  Chat: { contactId: string };
};
