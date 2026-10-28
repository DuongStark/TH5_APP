import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCheck, Cloud } from '../components/Icons';
import Avatar from '../components/Avatar';
import ScreenHeader from '../components/ScreenHeader';
import { contacts } from '../data/demo';
import { useChat } from '../context/ChatContext';
import { colors, shared } from '../theme';

export default function NotificationsScreen() {
  const { notifications, markNotificationRead, markAllNotificationsRead } =
    useChat();
  const unread = notifications.filter(notice => !notice.read).length;

  return (
    <SafeAreaView style={shared.screen} edges={['top']}>
      <ScreenHeader
        title="Thông báo"
        subtitle={
          unread
            ? `${unread} thông báo chưa đọc`
            : 'Bạn đã đọc tất cả thông báo'
        }
      />
      <View style={styles.toolbar}>
        <Text style={styles.sectionLabel}>GẦN ĐÂY</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Đọc tất cả"
          accessibilityState={{ disabled: unread === 0 }}
          disabled={unread === 0}
          onPress={markAllNotificationsRead}
          style={styles.readAll}
        >
          <CheckCheck
            size={17}
            color={unread ? colors.primary : colors.faint}
          />
          <Text style={[styles.readAllText, !unread && styles.disabled]}>
            Đọc tất cả
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const contact = contacts.find(person => person.id === item.contactId);
          return (
            <TouchableOpacity
              accessibilityRole={item.read ? undefined : 'button'}
              accessibilityLabel={
                item.read
                  ? `${item.content} Đã đọc.`
                  : `Đánh dấu đã đọc: ${item.content}`
              }
              disabled={item.read}
              onPress={() => markNotificationRead(item.id)}
              activeOpacity={0.7}
              style={[styles.notification, !item.read && styles.unread]}
            >
              {contact ? (
                <Avatar source={contact.avatar} name={contact.name} size={46} />
              ) : (
                <View style={styles.systemIcon}>
                  <Cloud color={colors.primary} size={24} strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.info}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.content}>{item.content}</Text>
                <View style={styles.meta}>
                  <Text style={styles.time}>{item.time}</Text>
                  <Text
                    style={[styles.state, !item.read && styles.unreadState]}
                  >
                    {item.read ? 'Đã đọc' : 'Chạm để đánh dấu đã đọc'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: colors.faint,
  },
  readAll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    minHeight: 44,
  },
  readAllText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  disabled: { color: colors.faint },
  list: { paddingHorizontal: 16, paddingBottom: 28 },
  notification: {
    padding: 17,
    borderRadius: 20,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unread: { backgroundColor: '#F5EDF0', borderColor: '#EADCE2' },
  systemIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  content: { fontSize: 13, lineHeight: 21, color: colors.muted },
  meta: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  time: { fontSize: 11, color: colors.faint },
  state: { fontSize: 10, color: colors.faint },
  unreadState: { color: colors.primary },
});
