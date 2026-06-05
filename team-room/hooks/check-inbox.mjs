#!/usr/bin/env node
// CLI receive (Layer 1). On SessionStart and each UserPromptSubmit, fetch this session's unread
// Team Room messages and inject them into the agent's context so a teammate's agent doesn't need
// the human to relay. No marker (session not connected) → silent no-op.
import { readMarker, fetchUnread, formatInbox } from '../lib/team-room-core.mjs';

function readStdin() {
  process.stdin.setEncoding('utf8');
  return new Promise((res) => { let b = ''; process.stdin.on('data', (c) => (b += c)); process.stdin.on('end', () => res(b)); });
}

async function main() {
  let event; try { event = JSON.parse((await readStdin()) || '{}'); } catch { return; }
  const sid = event.session_id || process.env.CLAUDE_CODE_SESSION_ID;
  if (!sid) return;
  const marker = readMarker(sid);
  if (!marker) return;
  const text = formatInbox(await fetchUnread(marker));
  if (!text) return;
  const eventName = event.hook_event_name || 'UserPromptSubmit';
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text } }));
}
main();
