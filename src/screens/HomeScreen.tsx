import React, { useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SquarePen } from '../components/Icons';
import Avatar from '../components/Avatar';
import SearchField from '../components/SearchField';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import ListDivider from '../components/ListDivider';
import { useChat } from '../context/ChatContext';
import { matchesSearch } from '../utils/search';
import { colors, shared } from '../theme';
import type { RootStackParams } from '../types';

export default function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const { username, showOnline, conversations, contacts, dataLoading } =
    useChat();
  const [query, setQuery] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const unread = conversations.reduce((total, chat) => total + chat.unread, 0);
  const unreadChats = conversations.filter(chat => chat.unread > 0).length;
  const filtered = conversations.filter(chat => {
    const contact = contacts.find(person => person.id === chat.contactId);
    return (
      contact &&
      matchesSearch(contact.name, query) &&
      (!unreadOnly || chat.unread > 0)
    );
  });

  function openChat(contactId: string) {
    navigation.navigate('Chat', { contactId });
  }

  return (
    <SafeAreaView style={shared.screen} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={item => item.contactId}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <ScreenHeader
              title="Tin nhắn"
              subtitle={
                unread
                  ? `${unread} tin nhắn chưa đọc`
                  : 'Bạn đã đọc hết tin nhắn'
              }
              action={
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Mở cài đặt tài khoản"
                  onPress={() =>
                    navigation.navigate('Main', { screen: 'Settings' })
                  }
                >
                  <Avatar
                    name={username ?? 'M'}
                    online={showOnline}
                    size={46}
                  />
                </TouchableOpacity>
              }
            />
            <SearchField
              value={query}
              onChangeText={setQuery}
              label="Tìm cuộc trò chuyện"
            />
            {!query.trim() && (
              <View style={styles.activeSection}>
                <Text style={styles.sectionLabel}>ĐANG HOẠT ĐỘNG</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.activeList}
                >
                  {contacts
                    .filter(contact => contact.online)
                    .map(contact => (
                      <TouchableOpacity
                        key={contact.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Nhắn tin nhanh với ${contact.name}`}
                        style={styles.activeContact}
                        onPress={() => openChat(contact.id)}
                      >
                        <Avatar
                          name={contact.name}
                          source={contact.avatar}
                          online
                          size={52}
                        />
                        <Text style={styles.activeName}>
                          {contact.name.split(' ').pop()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.filters}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: !unreadOnly }}
                onPress={() => setUnreadOnly(false)}
                style={[styles.filter, !unreadOnly && styles.selectedFilter]}
              >
                <Text
                  style={[
                    styles.filterText,
                    !unreadOnly && styles.selectedText,
                  ]}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Chỉ hiện cuộc trò chuyện chưa đọc"
                accessibilityState={{ selected: unreadOnly }}
                onPress={() => setUnreadOnly(true)}
                style={[styles.filter, unreadOnly && styles.selectedFilter]}
              >
                <Text
                  style={[styles.filterText, unreadOnly && styles.selectedText]}
                >
                  Chưa đọc{unreadChats ? ` (${unreadChats})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ItemSeparatorComponent={ListDivider}
        ListEmptyComponent={
          <EmptyState
            title={
              query.trim()
                ? 'Không tìm thấy cuộc trò chuyện'
                : dataLoading
                ? 'Đang tải cuộc trò chuyện…'
                : unreadOnly
                ? 'Không có tin nhắn chưa đọc'
                : 'Chưa có cuộc trò chuyện'
            }
            description={
              query.trim()
                ? 'Thử tìm bằng một tên khác nhé.'
                : unreadOnly
                ? 'Các cuộc trò chuyện đã đọc nằm trong mục Tất cả.'
                : 'Mở Danh bạ và gửi tin nhắn đầu tiên.'
            }
          />
        }
        renderItem={({ item }) => {
          const contact = contacts.find(
            person => person.id === item.contactId,
          )!;
          const lastMessage = item.messages[item.messages.length - 1];
          return (
            <TouchableOpacity
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel={`Trò chuyện với ${contact.name}${
                item.unread ? `, ${item.unread} tin chưa đọc` : ''
              }`}
              onPress={() => openChat(contact.id)}
              style={styles.chatRow}
            >
              <Avatar
                source={contact.avatar}
                name={contact.name}
                online={contact.online}
                size={56}
              />
              <View style={styles.chatContent}>
                <Text
                  numberOfLines={1}
                  style={[styles.name, item.unread > 0 && styles.unreadName]}
                >
                  {contact.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.preview,
                    item.unread > 0 && styles.unreadPreview,
                  ]}
                >
                  {lastMessage
                    ? `${lastMessage.mine ? 'Bạn: ' : ''}${lastMessage.text}`
                    : 'Bắt đầu cuộc trò chuyện'}
                </Text>
              </View>
              <View style={styles.chatMeta}>
                <Text
                  style={[styles.time, item.unread > 0 && styles.unreadTime]}
                >
                  {lastMessage?.time ?? 'Mới'}
                </Text>
                {item.unread > 0 && (
                  <View style={shared.badge}>
                    <Text style={shared.badgeText}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Cuộc trò chuyện mới"
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Main', { screen: 'Contacts' })}
        style={styles.compose}
      >
        <SquarePen size={24} color={colors.surface} strokeWidth={1.7} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 94 },
  activeSection: { marginBottom: 19 },
  sectionLabel: {
    color: colors.faint,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
    marginHorizontal: 24,
    marginBottom: 14,
  },
  activeList: { paddingHorizontal: 24, gap: 22 },
  activeContact: { alignItems: 'center', width: 58, gap: 8 },
  activeName: { fontSize: 12, color: colors.muted },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  filter: {
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: 20,
    justifyContent: 'center',
  },
  selectedFilter: { backgroundColor: colors.primaryLight },
  filterText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  selectedText: { color: colors.primary, fontWeight: '700' },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 14,
  },
  chatContent: { flex: 1, gap: 7 },
  name: { fontSize: 16, color: colors.text, fontWeight: '500' },
  unreadName: { fontWeight: '700' },
  preview: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  unreadPreview: { color: colors.text },
  chatMeta: {
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    minWidth: 36,
    paddingVertical: 3,
  },
  time: { fontSize: 11, color: colors.faint },
  unreadTime: { color: colors.primary, fontWeight: '500' },
  compose: {
    position: 'absolute',
    bottom: 22,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
  },
});
