import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, ArrowUp, Check } from '../components/Icons';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import { useChat } from '../context/ChatContext';
import { useIsFocused } from '@react-navigation/native';
import { currentLocation, openLocation } from '../services/location';
import { errorMessage } from '../services/auth';
import { colors, shared } from '../theme';
import type { Message, RootStackParams } from '../types';

type Props = NativeStackScreenProps<RootStackParams, 'Chat'>;

export default function ChatScreen({ navigation, route }: Props) {
  const { contactId } = route.params;
  const { conversations, contacts, sendMessage, markRead } = useChat();
  const contact = contacts.find(person => person.id === contactId);
  const focused = useIsFocused();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setAppActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);
  const list = useRef<FlatList<Message>>(null);
  const messages =
    conversations.find(chat => chat.contactId === contactId)?.messages ?? [];
  const canSend = !!draft.trim() && !busy;
  const latest = useRef({ messages, markRead });
  latest.current = { messages, markRead };
  const unreadIds = messages
    .filter(message => !message.mine)
    .map(message => message.id)
    .join(',');
  // Chỉ đánh dấu đã đọc khi màn Chat thực sự đang mở và app ở foreground.
  const readVisible = useCallback(() => {
    if (focused && appActive) {
      latest.current
        .markRead(contactId, latest.current.messages)
        .catch(reason => setError(errorMessage(reason)));
    }
  }, [focused, appActive, contactId]);
  useEffect(() => {
    readVisible();
  }, [readVisible, unreadIds]);

  async function send() {
    if (!canSend) {
      return;
    }
    const text = draft;
    setBusy(true);
    setError('');
    try {
      await sendMessage(contactId, text);
      setDraft(current => (current === text ? '' : current));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function sendLocation() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const coordinates = await currentLocation();
      await sendMessage(contactId, '📍 Vị trí hiện tại', coordinates);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!contact) {
    return (
      <SafeAreaView style={shared.screen}>
        <EmptyState
          title="Không tìm thấy người dùng"
          description="Quay lại danh bạ để chọn một người bạn."
        />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
          style={styles.fallback}
        >
          <Text style={styles.fallbackText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          onPress={() => navigation.goBack()}
          style={shared.iconButton}
        >
          <ArrowLeft color={colors.text} size={23} strokeWidth={1.7} />
        </TouchableOpacity>
        <Avatar
          source={contact.avatar}
          name={contact.name}
          online={contact.online}
          size={43}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{contact.name}</Text>
          <Text style={[styles.status, contact.online && styles.online]}>
            {contact.lastSeen}
          </Text>
        </View>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.messages}
          onContentSizeChange={() =>
            list.current?.scrollToEnd({ animated: false })
          }
          onLayout={() => list.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState
              title={`Chào ${contact.name.split(' ').pop()} một tiếng nhé`}
              description="Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện."
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.messageRow, item.mine && styles.myRow]}>
              {!item.mine && (
                <Avatar source={contact.avatar} name={contact.name} size={29} />
              )}
              <View style={[styles.bubble, item.mine && styles.myBubble]}>
                {item.type === 'location' ? (
                  <TouchableOpacity
                    accessibilityRole="link"
                    accessibilityLabel="Mở vị trí trên Google Maps"
                    style={styles.locationCard}
                    onPress={() =>
                      openLocation(item.latitude!, item.longitude!).catch(
                        reason => setError(errorMessage(reason)),
                      )
                    }
                  >
                    <Text style={styles.pin}>📍</Text>
                    <Text
                      style={[styles.locationTitle, item.mine && styles.myText]}
                    >
                      Vị trí hiện tại
                    </Text>
                    <Text
                      style={[styles.messageText, item.mine && styles.myText]}
                    >
                      {item.latitude?.toFixed(5)}, {item.longitude?.toFixed(5)}
                    </Text>
                    <Text style={[styles.time, item.mine && styles.myTime]}>
                      Chạm để mở Google Maps ↗
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text
                    style={[styles.messageText, item.mine && styles.myText]}
                  >
                    {item.text}
                  </Text>
                )}
                <View style={styles.messageMeta}>
                  <Text style={[styles.time, item.mine && styles.myTime]}>
                    {new Date(item.createdAt).toLocaleDateString('vi-VN')} ·{' '}
                    {item.time}
                  </Text>
                  {item.mine && (
                    <Check color="#DCC7D0" size={12} strokeWidth={1.7} />
                  )}
                </View>
              </View>
            </View>
          )}
        />
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {busy && <Text style={styles.progress}>Đang xử lý…</Text>}
        <View style={styles.composer}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Gửi vị trí hiện tại"
            onPress={sendLocation}
            disabled={busy}
            style={styles.locationButton}
          >
            <Text style={styles.pin}>📍</Text>
          </TouchableOpacity>
          <TextInput
            accessibilityLabel="Tin nhắn"
            placeholder="Viết tin nhắn..."
            placeholderTextColor={colors.faint}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            style={styles.input}
            textAlignVertical="center"
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Gửi tin nhắn"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={send}
            style={[styles.send, !canSend && styles.sendDisabled]}
            activeOpacity={0.8}
          >
            <ArrowUp
              size={23}
              color={canSend ? colors.surface : colors.faint}
              strokeWidth={2}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, padding: 12, backgroundColor: colors.surface },
  progress: { color: colors.muted, textAlign: 'center', padding: 4 },
  locationButton: {
    width: 40,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: { fontSize: 27 },
  locationCard: { minWidth: 165, gap: 8, padding: 3 },
  locationTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  flex: { flex: 1 },
  header: {
    paddingHorizontal: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInfo: { flex: 1, gap: 5 },
  name: { fontSize: 16, color: colors.text, fontWeight: '700' },
  status: { fontSize: 11, color: colors.muted },
  online: { color: colors.green },
  messages: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    flexGrow: 1,
  },
  date: {
    alignSelf: 'center',
    backgroundColor: colors.input,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 6,
    marginTop: 12,
    marginBottom: 27,
  },
  dateText: { fontSize: 11, color: colors.muted },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    marginBottom: 15,
    paddingRight: 34,
  },
  myRow: { justifyContent: 'flex-end', paddingRight: 0, paddingLeft: 45 },
  bubble: {
    flexShrink: 1,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 9,
    borderRadius: 20,
    borderBottomLeftRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  myBubble: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 5,
  },
  messageText: { fontSize: 15, lineHeight: 23, color: colors.text },
  myText: { color: colors.surface },
  messageMeta: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  time: { fontSize: 10, color: colors.faint },
  myTime: { color: '#DCC7D0' },
  demoNote: {
    fontSize: 10,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.faint,
    marginTop: 10,
    marginBottom: 12,
  },
  composer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    backgroundColor: colors.input,
    borderRadius: 21,
    paddingHorizontal: 17,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { backgroundColor: colors.input },
  fallback: { alignSelf: 'center', padding: 15 },
  fallbackText: { color: colors.primary, fontSize: 15 },
});
