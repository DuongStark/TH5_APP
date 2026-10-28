import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chatId,
  messagesFrom,
  unreadCount,
  matchesSearch,
  validateMessage,
  mapUrl,
} from '../core.mjs';

test('two participants share an ID and self chat is rejected', () => {
  assert.equal(chatId('alice', 'bob'), chatId('bob', 'alice'));
  assert.throws(() => chatId('alice', 'alice'));
});
test('messages sort by timestamp and preserve literal text, unread uses individual receipts', () => {
  const chat = {
    messages: {
      b: { senderId: 'bob', createdAt: 200, text: '<img onerror=alert(1)>' },
      a: { senderId: 'alice', createdAt: 100, text: 'Chào' },
      c: { senderId: 'bob', createdAt: 200, text: 'Mới' },
    },
    receipts: { alice: { b: true } },
  };
  assert.deepEqual(
    messagesFrom(chat).map(message => message.id),
    ['a', 'b', 'c'],
  );
  assert.equal(messagesFrom(chat)[1].text, '<img onerror=alert(1)>');
  assert.equal(unreadCount(chat, 'alice'), 1);
});
test('search supports Vietnamese accents, Đ and case folding', () => {
  assert.equal(matchesSearch('Trần Bình', '  TRAN binh '), true);
  assert.equal(matchesSearch('Minh Đức', 'duc'), true);
  assert.equal(matchesSearch('Nguyễn An', 'Bình'), false);
});
test('rejects whitespace and long messages and validates map coordinates', () => {
  assert.throws(() => validateMessage(' \n\t '));
  assert.throws(() => validateMessage('a'.repeat(2001)));
  assert.equal(validateMessage('  Xin chào  '), 'Xin chào');
  assert.equal(
    mapUrl(21.02851, 105.804817),
    'https://www.google.com/maps/search/?api=1&query=21.02851,105.804817',
  );
  assert.throws(() => mapUrl(91, 105));
  assert.throws(() => mapUrl('21', 105));
});
