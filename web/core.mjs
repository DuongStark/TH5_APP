// Các hàm thuần dùng chung cho giao diện web và kiểm thử.
export function chatId(first, second) {
  if (!first || !second || first === second) {
    throw new Error('Cần chọn một người dùng khác để trò chuyện.');
  }
  return [first, second].sort().join('_');
}

export function messagesFrom(chat = {}) {
  return Object.entries(chat.messages ?? {})
    .map(([id, message]) => ({ ...message, id }))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export function unreadCount(chat, uid) {
  return messagesFrom(chat).filter(
    message => message.senderId !== uid && !chat.receipts?.[uid]?.[message.id],
  ).length;
}

export function matchesSearch(name, query) {
  const normalize = value =>
    String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  return normalize(name).includes(normalize(query));
}

export function validateMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000) {
    throw new Error('Tin nhắn cần có từ 1 đến 2000 ký tự.');
  }
  return trimmed;
}

export function mapUrl(latitude, longitude) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new Error('Tọa độ vị trí không hợp lệ.');
  }
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export function timeText(timestamp) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}
