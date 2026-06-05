#!/usr/bin/env node
// CLI capture. Claude Code pipes the hook event JSON on stdin (it carries session_id); we map it
// to a room activity and POST with the write-token from THIS session's marker
// (~/.team-room/sessions/<session_id>.json). We also touch the per-session heartbeat each event
// so the desktop daemon knows this session's hooks are live and stands down. No marker → silent.
import { readFileSync } from 'node:fs';
import { readMarker, postActivity, mapHookEvent, lastAssistantText, touchHeartbeat, MAX } from '../lib/team-room-core.mjs';

function readStdin() {
  process.stdin.setEncoding('utf8');
  return new Promise((res) => { let b = ''; process.stdin.on('data', (c) => (b += c)); process.stdin.on('end', () => res(b)); });
}

function toActivity(event) {
  if (event?.hook_event_name === 'Stop') {
    if (!event.transcript_path) return null;
    let text = null;
    try { text = lastAssistantText(readFileSync(event.transcript_path, 'utf8')); } catch { return null; }
    return text ? { kind: 'agent_message', summary: text.slice(0, MAX) } : null;
  }
  return mapHookEvent(event ?? {});
}

async function main() {
  let event;
  try { event = JSON.parse((await readStdin()) || '{}'); } catch { return; }
  const sid = event.session_id || process.env.CLAUDE_CODE_SESSION_ID;
  if (!sid) return;
  touchHeartbeat(sid); // this session's hooks are live → the desktop daemon stands down for it
  const activity = toActivity(event);
  if (!activity) return;
  const marker = readMarker(sid);
  if (!marker) return; // this session isn't connected → private (default)
  await postActivity(marker, activity);
}
main();
