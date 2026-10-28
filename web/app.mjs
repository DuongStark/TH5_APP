import {
  watchSession,
  login,
  register,
  logout,
  ensureProfile,
  errorMessage,
  watchContacts,
  watchConversations,
  sendMessage,
  markRead,
  startPresence,
} from './services/firebase.mjs';
import {
  chatId,
  messagesFrom,
  unreadCount,
  matchesSearch,
  mapUrl,
  timeText,
} from './core.mjs';

const $ = id => document.getElementById(id);
// State đơn giản của giao diện. Tin nhắn lấy từ Firebase, không tự sinh phản hồi.
const state = {
  user: null,
  contacts: [],
  chats: new Map(),
  view: 'home',
  returnView: 'home',
  peer: null,
  query: '',
  unreadOnly: false,
  busy: false,
};
let registering = false,
  stopContacts = () => {},
  stopChats = () => {},
  stopPresence = null;
let sessionVersion = 0,
  renderedMessages = '',
  messageSession = 0;
const reading = new Set();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  // textContent giữ tin nhắn và tên người dùng là văn bản, không chạy HTML.
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}
function avatar(name, size = 54, online = false) {
  const node = element(
    'div',
    'avatar',
    (name || 'M').trim().charAt(0).toLocaleUpperCase('vi'),
  );
  node.style.setProperty('--avatar-size', `${size}px`);
  node.setAttribute('aria-label', `Ảnh đại diện ${name}`);
  if (online) {
    node.append(element('span', 'avatar-dot'));
  }
  return node;
}
function empty(title, description) {
  const node = element('div', 'empty-state');
  const symbol = element('div', 'empty-symbol');
  symbol.append(icon('chat'));
  node.append(symbol, element('h2', '', title), element('p', '', description));
  return node;
}
function showError(id, reason) {
  const node = $(id);
  node.textContent = reason ? errorMessage(reason) : '';
  node.hidden = !reason;
}
function showScreen(name) {
  for (const id of ['loading', 'auth', 'main', 'chat']) {
    $(`${id}-screen`).hidden = id !== name;
  }
}
function go(view) {
  if (!state.user) {
    return;
  }
  if (state.view === 'chat') {
    messageSession++;
  }
  state.view = view;
  state.query = '';
  $('search').value = '';
  showError('global-error', null);
  showScreen('main');
  renderMain();
}

function conversationRows() {
  return [...state.chats.values()]
    .map(chat => ({
      chat,
      messages: messagesFrom(chat),
      peer: state.contacts.find(person => person.id === chat.peerId),
    }))
    .filter(item => item.peer && item.messages.length)
    .sort((a, b) => b.messages.at(-1).createdAt - a.messages.at(-1).createdAt);
}
function renderMain() {
  if (!state.user) {
    return;
  }
  const view = state.view;
  if (view === 'chat') {
    return;
  }
  $('main-screen').dataset.view = view;
  const unread = [...state.chats.values()].reduce(
    (total, chat) => total + unreadCount(chat, state.user.uid),
    0,
  );
  const online = state.contacts.filter(person => person.online);
  const isHome = view === 'home',
    isContacts = view === 'contacts';
  const titles = {
    home: 'Tin nhắn',
    contacts: 'Danh bạ',
    notifications: 'Thông báo',
    settings: 'Cài đặt',
  };
  $('main-title').textContent = titles[view];
  $('main-subtitle').textContent = isHome
    ? unread
      ? `${unread} tin nhắn chưa đọc`
      : 'Bạn đã đọc hết tin nhắn'
    : isContacts
    ? `${state.contacts.length} người bạn · ${online.length} đang hoạt động`
    : view === 'settings'
    ? 'Tài khoản của bạn'
    : 'Bạn đã đọc tất cả thông báo';
  const name = state.user.displayName || state.user.email.split('@')[0];
  $('self-avatar').replaceChildren(avatar(name, 46, true));
  $('self-avatar').hidden = !isHome;
  $('search-box').hidden = !isHome && !isContacts;
  $('search').placeholder = isContacts
    ? 'Tìm trong danh bạ'
    : 'Tìm cuộc trò chuyện';
  $('search').setAttribute('aria-label', $('search').placeholder);
  $('active-section').hidden = !isHome || !!state.query.trim();
  $('home-filters').hidden = !isHome;
  $('contacts-section').hidden = !isContacts;
  $('settings-content').hidden = view !== 'settings';
  $('compose-button').hidden = !isHome;
  $('all-filter').classList.toggle('selected', !state.unreadOnly);
  $('unread-filter').classList.toggle('selected', state.unreadOnly);
  const unreadChats = conversationRows().filter(
    ({ chat }) => unreadCount(chat, state.user.uid) > 0,
  ).length;
  $('unread-filter').textContent = unreadChats
    ? `Chưa đọc (${unreadChats})`
    : 'Chưa đọc';
  $('tab-unread').textContent = unread;
  $('tab-unread').hidden = !unread;
  document
    .querySelectorAll('[data-tab]')
    .forEach(button =>
      button.classList.toggle('active', button.dataset.tab === view),
    );
  $('active-list').replaceChildren(
    ...online.map(person => {
      const button = element('button', 'active-person');
      button.setAttribute('aria-label', `Nhắn tin nhanh với ${person.name}`);
      button.append(
        avatar(person.name, 52, true),
        element('span', '', person.name.split(' ').pop()),
      );
      button.addEventListener('click', () => openChat(person.id));
      return button;
    }),
  );
  const rows = [];
  if (isHome) {
    for (const { chat, messages, peer } of conversationRows()) {
      const count = unreadCount(chat, state.user.uid);
      if (
        !matchesSearch(peer.name, state.query) ||
        (state.unreadOnly && !count)
      ) {
        continue;
      }
      const last = messages.at(-1);
      const button = personButton(
        peer,
        'person-row' + (count ? ' unread' : ''),
      );
      const info = element('div', 'person-info');
      info.append(
        element('span', 'person-name', peer.name),
        element(
          'span',
          'person-preview',
          `${last.senderId === state.user.uid ? 'Bạn: ' : ''}${last.text}`,
        ),
      );
      const meta = element('div', 'person-meta');
      meta.append(element('span', 'person-time', timeText(last.createdAt)));
      if (count) {
        meta.append(element('b', 'badge', count));
      }
      button.append(info, meta);
      rows.push(button);
    }
    if (!rows.length) {
      rows.push(
        empty(
          state.query
            ? 'Không tìm thấy cuộc trò chuyện'
            : state.unreadOnly
            ? 'Không có tin nhắn chưa đọc'
            : 'Chưa có cuộc trò chuyện',
          'Mở Danh bạ và gửi tin nhắn đầu tiên.',
        ),
      );
    }
  } else if (isContacts) {
    const people = state.contacts.filter(person =>
      matchesSearch(person.name, state.query),
    );
    $('contacts-count').textContent = people.length;
    for (const person of people) {
      const button = personButton(person, 'person-row contact-row');
      const info = element('div', 'person-info');
      info.append(
        element('span', 'person-name', person.name),
        element(
          'span',
          'person-preview' + (person.online ? ' online-text' : ''),
          person.online ? 'Đang hoạt động' : 'Offline',
        ),
      );
      const action = element('span', 'contact-chat-icon');
      action.append(icon('chat'));
      button.append(info, action);
      rows.push(button);
    }
    if (!rows.length) {
      rows.push(
        empty(
          'Không tìm thấy người dùng',
          'Đăng ký tài khoản thứ hai ở khung bên cạnh để trò chuyện.',
        ),
      );
    }
  } else if (view === 'settings') {
    $('profile-avatar').replaceChildren(avatar(name, 80, true));
    $('profile-name').textContent = name;
    $('profile-email').textContent = state.user.email;
  } else {
    rows.push(
      empty(
        'Bạn đã đọc tất cả thông báo',
        'Các cuộc trò chuyện nằm trong mục Tin nhắn.',
      ),
    );
  }
  $('people-list').replaceChildren(...rows);
}
function personButton(peer, className) {
  const button = element('button', className);
  button.setAttribute('aria-label', `Nhắn tin với ${peer.name}`);
  button.append(avatar(peer.name, 56, peer.online));
  button.addEventListener('click', () => openChat(peer.id));
  return button;
}

function openChat(peerId) {
  if (!state.user || !state.contacts.some(person => person.id === peerId)) {
    return;
  }
  state.returnView = state.view === 'contacts' ? 'contacts' : 'home';
  state.view = 'chat';
  state.peer = peerId;
  messageSession++;
  renderedMessages = '';
  $('draft').value = '';
  resizeDraft();
  showError('chat-error', null);
  showScreen('chat');
  renderChat();
  updateComposer();
}
function renderChat() {
  if (state.view !== 'chat' || !state.user) {
    return;
  }
  const peer = state.contacts.find(person => person.id === state.peer);
  if (!peer) {
    return;
  }
  $('chat-avatar').replaceChildren(avatar(peer.name, 43, peer.online));
  $('peer-name').textContent = peer.name;
  $('peer-status').textContent = peer.online ? 'Đang hoạt động' : 'Offline';
  $('peer-status').classList.toggle('online-text', peer.online);
  const chat = state.chats.get(chatId(state.user.uid, peer.id)) || {};
  const messages = messagesFrom(chat);
  const signature = peer.id + JSON.stringify(messages);
  // Receipt hoặc trạng thái online đổi không dựng lại toàn bộ tin nhắn.
  if (signature !== renderedMessages) {
    renderedMessages = signature;
    const nodes = messages.map(message => messageBubble(message, peer));
    if (!nodes.length) {
      nodes.push(
        empty(
          `Chào ${peer.name.split(' ').pop()} một tiếng nhé`,
          'Gửi tin nhắn đầu tiên để bắt đầu cuộc trò chuyện.',
        ),
      );
    }
    $('messages').replaceChildren(...nodes);
    requestAnimationFrame(() => {
      $('messages').scrollTop = $('messages').scrollHeight;
    });
  }
  readVisibleMessages(chat, messages);
}
function messageBubble(message, peer) {
  const mine = message.senderId === state.user.uid;
  const row = element('div', 'message-row' + (mine ? ' mine' : ''));
  row.dataset.messageId = message.id;
  if (!mine) {
    row.append(avatar(peer.name, 29));
  }
  const bubble = element('div', 'bubble');
  if (message.type === 'location') {
    try {
      const link = element('a', 'location-card');
      link.href = mapUrl(message.latitude, message.longitude);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', 'Mở vị trí trên Google Maps');
      link.append(
        element('span', 'pin', '📍'),
        element('span', 'location-title', 'Vị trí hiện tại'),
        element(
          'span',
          'message-text',
          `${message.latitude.toFixed(5)}, ${message.longitude.toFixed(5)}`,
        ),
        element('span', 'location-hint', 'Chạm để mở Google Maps ↗'),
      );
      bubble.append(link);
    } catch {
      bubble.append(element('p', 'message-text', 'Vị trí không hợp lệ.'));
    }
  } else {
    bubble.append(element('p', 'message-text', message.text));
  }
  const meta = element('div', 'message-meta');
  meta.append(
    element(
      'span',
      'message-time',
      `${new Date(message.createdAt).toLocaleDateString('vi-VN')} · ${timeText(
        message.createdAt,
      )}`,
    ),
  );
  if (mine) {
    meta.append(icon('check'));
  }
  bubble.append(meta);
  row.append(bubble);
  return row;
}
function readVisibleMessages(chat, messages) {
  if (document.hidden || !state.user || state.view !== 'chat') {
    return;
  }
  const uid = state.user.uid,
    peer = state.peer;
  const ids = messages
    .filter(
      message =>
        message.senderId !== uid &&
        !chat.receipts?.[uid]?.[message.id] &&
        !reading.has(message.id),
    )
    .map(message => message.id);
  if (!ids.length) {
    return;
  }
  ids.forEach(id => reading.add(id));
  markRead(uid, peer, ids)
    .catch(error => {
      if (state.user?.uid === uid && state.peer === peer) {
        showError('chat-error', error);
      }
    })
    .finally(() => ids.forEach(id => reading.delete(id)));
}
function updateComposer() {
  $('send-button').disabled = !$('draft').value.trim() || state.busy;
  $('location-button').disabled = state.busy;
  $('send-progress').hidden = !state.busy;
}
function resizeDraft() {
  $('draft').style.height = '46px';
  $('draft').style.height = `${Math.min(
    120,
    Math.max(46, $('draft').scrollHeight),
  )}px`;
}
async function send(text, coordinates, session = messageSession) {
  if (state.busy || !state.user || state.view !== 'chat') {
    return;
  }
  const uid = state.user.uid,
    peer = state.peer;
  state.busy = true;
  updateComposer();
  showError('chat-error', null);
  try {
    await sendMessage(uid, peer, text, coordinates);
    if (
      !coordinates &&
      session === messageSession &&
      $('draft').value === text
    ) {
      $('draft').value = '';
      resizeDraft();
    }
  } catch (error) {
    if (session === messageSession) {
      showError('chat-error', error);
    }
  } finally {
    state.busy = false;
    updateComposer();
  }
}

$('composer').addEventListener('submit', event => {
  event.preventDefault();
  if ($('draft').value.trim()) {
    send($('draft').value);
  }
});
$('draft').addEventListener('input', () => {
  resizeDraft();
  updateComposer();
});
$('draft').addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    $('composer').requestSubmit();
  }
});
$('location-button').addEventListener('click', async () => {
  if (state.busy || !state.user) {
    return;
  }
  const session = messageSession;
  const uid = state.user.uid,
    peer = state.peer;
  state.busy = true;
  updateComposer();
  showError('chat-error', null);
  try {
    if (!navigator.geolocation) {
      throw new Error('Trình duyệt không hỗ trợ vị trí.');
    }
    const coordinates = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        error =>
          reject(
            new Error(
              error.code === 1
                ? 'Bạn đã từ chối quyền vị trí. Hãy cấp quyền trong trình duyệt để gửi vị trí.'
                : 'Không lấy được vị trí. Kiểm tra GPS và thử lại.',
            ),
          ),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    });
    // Không gửi nhầm sang người khác nếu chuyển màn hình khi đang xin quyền.
    if (
      session !== messageSession ||
      state.user?.uid !== uid ||
      state.peer !== peer
    ) {
      return;
    }
    await sendMessage(uid, peer, '📍 Vị trí hiện tại', coordinates);
  } catch (error) {
    if (session === messageSession) {
      showError('chat-error', error);
    }
  } finally {
    state.busy = false;
    updateComposer();
  }
});
$('chat-back').addEventListener('click', () => go(state.returnView));
$('search').addEventListener('input', () => {
  state.query = $('search').value;
  renderMain();
});
$('all-filter').addEventListener('click', () => {
  state.unreadOnly = false;
  renderMain();
});
$('unread-filter').addEventListener('click', () => {
  state.unreadOnly = true;
  renderMain();
});
$('compose-button').addEventListener('click', () => go('contacts'));
$('self-avatar').addEventListener('click', () => go('settings'));
for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', () => go(button.dataset.tab));
}
$('toggle-password').addEventListener('click', () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password';
  $('confirmation').type = show ? 'text' : 'password';
  $('toggle-password').setAttribute(
    'aria-label',
    show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu',
  );
});
$('switch-auth').addEventListener('click', () => {
  registering = !registering;
  $('auth-screen').classList.toggle('register', registering);
  $('name-field').hidden = $('confirmation-field').hidden = !registering;
  $('login-illustration').hidden = registering;
  $('auth-title').textContent = registering ? 'Tạo tài khoản' : 'Đăng nhập';
  $('auth-subtitle').textContent = registering
    ? 'Một lời chào, một kết nối mới.'
    : 'Cuộc trò chuyện đang chờ bạn.';
  $('auth-submit').querySelector('span').textContent = registering
    ? 'Đăng ký'
    : 'Đăng nhập';
  $('switch-auth').textContent = registering
    ? 'Đã có tài khoản? Đăng nhập'
    : 'Chưa có tài khoản? Đăng ký';
  $('password').autocomplete = registering
    ? 'new-password'
    : 'current-password';
  showError('auth-error', null);
});
$('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('auth-submit').disabled) {
    return;
  }
  showError('auth-error', null);
  if (!$('email').value.trim() || !$('password').value) {
    showError('auth-error', new Error('Vui lòng nhập email và mật khẩu.'));
    return;
  }
  $('auth-submit').disabled = true;
  const label = $('auth-submit').querySelector('span');
  label.textContent = registering ? 'Đang tạo tài khoản…' : 'Đang đăng nhập…';
  try {
    if (registering) {
      await register(
        $('full-name').value,
        $('email').value,
        $('password').value,
        $('confirmation').value,
      );
    } else {
      await login($('email').value, $('password').value);
    }
    $('password').value = $('confirmation').value = '';
  } catch (error) {
    showError('auth-error', error);
  } finally {
    $('auth-submit').disabled = false;
    label.textContent = registering ? 'Đăng ký' : 'Đăng nhập';
  }
});
$('logout-button').addEventListener('click', async () => {
  $('logout-button').disabled = true;
  try {
    if (stopPresence) {
      await stopPresence();
      stopPresence = null;
    }
    await logout();
  } catch (error) {
    showError('global-error', error);
  } finally {
    $('logout-button').disabled = false;
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    renderChat();
  }
});
watchSession(async user => {
  const version = ++sessionVersion;
  stopContacts();
  stopChats();
  if (stopPresence) {
    stopPresence().catch(() => {});
    stopPresence = null;
  }
  state.user = user;
  state.contacts = [];
  state.chats = new Map();
  state.peer = null;
  state.busy = false;
  state.view = 'home';
  state.query = '';
  state.unreadOnly = false;
  messageSession++;
  renderedMessages = '';
  reading.clear();
  showError('global-error', null);
  if (!user) {
    $('auth-form').reset();
    showScreen('auth');
    return;
  }
  showScreen('main');
  renderMain();
  const report = error => {
    if (version === sessionVersion) {
      showError('global-error', error);
    }
  };
  try {
    await ensureProfile(user);
    if (version !== sessionVersion) {
      return;
    }
    stopContacts = watchContacts(
      user.uid,
      contacts => {
        state.contacts = contacts;
        renderMain();
        renderChat();
      },
      report,
    );
    stopChats = watchConversations(
      user.uid,
      chats => {
        state.chats = chats;
        renderMain();
        renderChat();
      },
      report,
    );
    stopPresence = startPresence(user.uid, report);
  } catch (error) {
    report(error);
  }
});
