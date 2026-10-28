import type { ChatNotification, Contact } from '../types';

export const contacts: Contact[] = [
  {
    id: 'ngoc',
    name: 'Bảo Ngọc',
    avatar: require('../assets/ngoc.jpg'),
    online: true,
    lastSeen: 'Đang hoạt động',
  },
  {
    id: 'nam',
    name: 'Hoàng Nam',
    avatar: require('../assets/nam.jpg'),
    online: true,
    lastSeen: 'Đang hoạt động',
  },
  {
    id: 'anh',
    name: 'Quỳnh Anh',
    avatar: require('../assets/anh.jpg'),
    online: false,
    lastSeen: 'Hoạt động 15 phút trước',
  },
  {
    id: 'duc',
    name: 'Minh Đức',
    avatar: require('../assets/duc.jpg'),
    online: true,
    lastSeen: 'Đang hoạt động',
  },
  {
    id: 'linh',
    name: 'Khánh Linh',
    avatar: require('../assets/linh.jpg'),
    online: false,
    lastSeen: 'Hoạt động 1 giờ trước',
  },
  {
    id: 'huy',
    name: 'Gia Huy',
    avatar: require('../assets/huy.jpg'),
    online: false,
    lastSeen: 'Hoạt động hôm qua',
  },
];

export const initialNotifications: ChatNotification[] = [
  {
    id: 'notice-1',
    contactId: 'ngoc',
    title: 'Tin nhắn mới',
    content: 'Bảo Ngọc đã gửi cho bạn 2 tin nhắn.',
    time: '09:41',
    read: false,
  },
  {
    id: 'notice-2',
    contactId: 'nam',
    title: 'Tin nhắn mới',
    content: 'Hoàng Nam đã gửi cho bạn một tin nhắn.',
    time: '09:18',
    read: false,
  },
  {
    id: 'notice-3',
    contactId: 'duc',
    title: 'Tin nhắn mới',
    content: 'Minh Đức đã gửi cho bạn 3 tin nhắn.',
    time: '08:25',
    read: false,
  },
  {
    id: 'notice-4',
    title: 'Chào mừng đến với Mây',
    content: 'Tài khoản của bạn đã sẵn sàng. Bắt đầu một cuộc trò chuyện nhé.',
    time: 'Hôm qua',
    read: true,
  },
];
