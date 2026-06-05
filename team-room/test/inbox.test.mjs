import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInbox } from '../lib/team-room-core.mjs';

test('formatInbox renders sender + body lines', () => {
  const out = formatInbox([{ from: 'David', body: 'pull main', kind: 'chat' }, { from: 'David', body: 'thanks', kind: 'chat' }]);
  assert.match(out, /Team Room — 2 new message/);
  assert.match(out, /pull main/);
  assert.match(out, /thanks/);
});
test('formatInbox returns empty string for no messages', () => {
  assert.equal(formatInbox([]), '');
});
