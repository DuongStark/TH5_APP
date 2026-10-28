import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import App from '../App';
import { ensureProfile, login, logout, register } from '../src/services/auth';
import { sendChatMessage } from '../src/services/chat';
import { currentLocation, openLocation } from '../src/services/location';
import { buildConversation } from '../src/utils/chat';
import type { Conversation } from '../src/types';

const mockUser = {
  uid: 'alice',
  displayName: 'Nguyễn An',
  email: 'an@example.com',
};
let mockSession: (user: typeof mockUser | null) => void;
let mockChats: (chats: Conversation[]) => void;
const mockStopContacts = jest.fn();
const mockStopChats = jest.fn();
const mockStopPresence = jest.fn(async () => {});
const mockStartPresence = jest.fn(
  (_uid: string, _onError: Function, _visible?: boolean) => ({
    setVisible: jest.fn(),
    stop: mockStopPresence,
  }),
);
const mockMessages = {
  one: {
    senderId: 'bob',
    type: 'text' as const,
    text: 'Chào An',
    createdAt: 1000,
  },
  two: {
    senderId: 'bob',
    type: 'location' as const,
    text: '📍 Vị trí hiện tại',
    latitude: 21,
    longitude: 105,
    createdAt: 2000,
  },
};
const mockConversations = () => [
  buildConversation('bob', { messages: mockMessages }, 'alice'),
];

jest.mock('../src/services/firebase', () => ({ usingEmulators: true }));
jest.mock('../src/services/auth', () => ({
  watchSession: (cb: typeof mockSession) => {
    mockSession = cb;
    cb(null);
    return jest.fn();
  },
  login: jest.fn(async () => mockSession(mockUser)),
  logout: jest.fn(async () => mockSession(null)),
  register: jest.fn(async () => {}),
  ensureProfile: jest.fn(async () => {}),
  errorMessage: (error: Error) => error.message,
}));
jest.mock('../src/services/chat', () => ({
  watchContacts: (_uid: string, cb: Function) => {
    cb([
      {
        id: 'bob',
        name: 'Trần Bình',
        online: true,
        lastSeen: 'Đang hoạt động',
      },
    ]);
    return mockStopContacts;
  },
  watchConversations: (_uid: string, cb: typeof mockChats) => {
    mockChats = cb;
    cb(mockConversations());
    return mockStopChats;
  },
  sendChatMessage: jest.fn(async () => {}),
  markMessagesRead: jest.fn(async () => {}),
}));
jest.mock('../src/services/presence', () => ({
  startPresence: (...args: Parameters<typeof mockStartPresence>) =>
    mockStartPresence(...args),
}));
jest.mock('../src/services/location', () => ({
  currentLocation: jest.fn(async () => ({ latitude: 21, longitude: 105 })),
  openLocation: jest.fn(async () => {}),
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});
async function signIn() {
  fireEvent.changeText(await screen.findByLabelText('Email'), 'an@example.com');
  fireEvent.changeText(screen.getByLabelText('Mật khẩu'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));
  await screen.findByLabelText('Tìm cuộc trò chuyện');
}

test('login validates fields and shows Firebase credential errors', async () => {
  render(<App />);
  fireEvent.press(await screen.findByRole('button', { name: 'Đăng nhập' }));
  expect(screen.getByText('Vui lòng nhập email.')).toBeOnTheScreen();
  expect(login).not.toHaveBeenCalled();
  jest
    .mocked(login)
    .mockRejectedValueOnce(new Error('Email hoặc mật khẩu không đúng.'));
  fireEvent.changeText(screen.getByLabelText('Email'), 'wrong@example.com');
  fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'wrong123');
  fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }));
  expect(
    await screen.findByText('Email hoặc mật khẩu không đúng.'),
  ).toBeOnTheScreen();
  expect(screen.queryByLabelText('Tìm cuộc trò chuyện')).toBeNull();
});

test('registration rejects mismatching passwords before calling Firebase', async () => {
  render(<App />);
  fireEvent.press(await screen.findByRole('button', { name: 'Tạo tài khoản' }));
  fireEvent.changeText(await screen.findByLabelText('Họ tên'), 'Nguyễn An');
  fireEvent.changeText(
    screen.getByLabelText('Email đăng ký'),
    'an@example.com',
  );
  fireEvent.changeText(screen.getByLabelText('Mật khẩu đăng ký'), '123456');
  fireEvent.changeText(screen.getByLabelText('Nhập lại mật khẩu'), '654321');
  fireEvent.press(screen.getByRole('button', { name: 'Đăng ký' }));
  expect(screen.getByText('Mật khẩu nhập lại không khớp.')).toBeOnTheScreen();
  expect(register).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Nhập lại mật khẩu'), '123456');
  fireEvent.press(screen.getByRole('button', { name: 'Đăng ký' }));
  await waitFor(() =>
    expect(register).toHaveBeenCalledWith(
      'Nguyễn An',
      'an@example.com',
      '123456',
      '123456',
    ),
  );
});

test('Home displays realtime unread counts and replaces repeated snapshots', async () => {
  render(<App />);
  await signIn();
  expect(
    screen.getByRole('button', {
      name: 'Trò chuyện với Trần Bình, 2 tin chưa đọc',
    }),
  ).toBeOnTheScreen();
  act(() => {
    mockChats(mockConversations());
    mockChats(mockConversations());
  });
  expect(
    screen.getAllByRole('button', { name: /Trò chuyện với Trần Bình/ }),
  ).toHaveLength(1);
  act(() =>
    mockChats([
      buildConversation(
        'bob',
        {
          messages: mockMessages,
          receipts: { alice: { one: true, two: true } },
        },
        'alice',
      ),
    ]),
  );
  expect(
    screen.getByRole('button', { name: 'Trò chuyện với Trần Bình' }),
  ).toBeOnTheScreen();
});

test('contact search ignores accents and opens live chat with text and location', async () => {
  render(<App />);
  await signIn();
  fireEvent.press(screen.getByLabelText('Danh bạ, tab'));
  fireEvent.changeText(
    await screen.findByLabelText('Tìm trong danh bạ'),
    'tran binh',
  );
  fireEvent.press(
    screen.getByRole('button', { name: /Nhắn tin với Trần Bình/ }),
  );
  const composer = await screen.findByLabelText('Tin nhắn');
  expect(screen.getByText('Chào An')).toBeOnTheScreen();
  fireEvent.changeText(composer, '   ');
  expect(screen.getByRole('button', { name: 'Gửi tin nhắn' })).toBeDisabled();
  fireEvent.changeText(composer, 'Xin chào');
  fireEvent.press(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
  await waitFor(() =>
    expect(sendChatMessage).toHaveBeenCalledWith(
      'alice',
      'bob',
      'Xin chào',
      undefined,
    ),
  );
  await waitFor(() => expect(composer).toHaveProp('value', ''));
  fireEvent.press(
    screen.getByRole('link', { name: 'Mở vị trí trên Google Maps' }),
  );
  expect(openLocation).toHaveBeenCalledWith(21, 105);
  fireEvent.press(screen.getByRole('button', { name: 'Gửi vị trí hiện tại' }));
  await waitFor(() =>
    expect(sendChatMessage).toHaveBeenCalledWith(
      'alice',
      'bob',
      '📍 Vị trí hiện tại',
      { latitude: 21, longitude: 105 },
    ),
  );
});

test('location permission denial is visible and does not send a message', async () => {
  render(<App />);
  await signIn();
  fireEvent.press(
    screen.getByRole('button', { name: /Trò chuyện với Trần Bình/ }),
  );
  await screen.findByLabelText('Tin nhắn');
  jest
    .mocked(currentLocation)
    .mockRejectedValueOnce(new Error('Bạn đã từ chối quyền vị trí.'));
  fireEvent.press(screen.getByRole('button', { name: 'Gửi vị trí hiện tại' }));
  expect(
    await screen.findByText('Bạn đã từ chối quyền vị trí.'),
  ).toBeOnTheScreen();
  expect(sendChatMessage).not.toHaveBeenCalled();
});

test('notifications retain the previous assignment behavior and logout cleans subscriptions', async () => {
  render(<App />);
  await signIn();
  fireEvent.press(screen.getByLabelText('Thông báo, tab'));
  fireEvent.press(await screen.findByRole('button', { name: 'Đọc tất cả' }));
  expect(
    await screen.findByText('Bạn đã đọc tất cả thông báo'),
  ).toBeOnTheScreen();
  fireEvent.press(screen.getByLabelText('Cài đặt, tab'));
  fireEvent.press(await screen.findByRole('button', { name: 'Đăng xuất' }));
  expect(await screen.findByLabelText('Email')).toHaveProp('value', '');
  expect(logout).toHaveBeenCalledTimes(1);
  expect(mockStopContacts).toHaveBeenCalledTimes(1);
  expect(mockStopChats).toHaveBeenCalledTimes(1);
});

test('hiding online before profile loading finishes applies to presence startup', async () => {
  let resolveProfile!: () => void;
  jest.mocked(ensureProfile).mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        resolveProfile = resolve;
      }),
  );
  render(<App />);
  await signIn();
  fireEvent.press(screen.getByLabelText('Cài đặt, tab'));
  fireEvent(
    await screen.findByRole('switch', {
      name: 'Hiển thị trạng thái hoạt động',
    }),
    'valueChange',
    false,
  );
  await act(async () => {
    resolveProfile();
  });
  expect(mockStartPresence).toHaveBeenCalledWith(
    'alice',
    expect.any(Function),
    false,
  );
});
