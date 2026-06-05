#!/usr/bin/env node
// CLI capture. Claude Code pipes the hook event JSON on stdin; we map it to a room activity
// and POST with the session-scoped write-token from the local .team-room marker. We also
// touch the hooks heartbeat on every event so the desktop watcher knows hooks are live here
// and stands down. If there's no marker (the user hasn't run /connect) we stay silent.
import { readFileSync } from 'node:fs';
import { readMarker, postActivity, mapHookEvent, lastAssistantText, touchHeartbeat } from '../lib/team-room-core.mjs';

function readStdin() {
  process.stdin.setEncoding('utf8');
  return new Promise((res) => { let b = ''; process.stdin.on('data', (c) => (b += c)); process.stdin.on('end', () => res(b)); });
}

function toActivity(event) {
  if (event?.hook_event_name === 'Stop') {
    if (!event.transcript_path) return null;
    let text = null;
    try { text = lastAssistantText(readFileSync(event.transcript_path, 'utf8')); } catch { return null; }
    return text ? { kind: 'agent_message', summary: text.slice(0, 500) } : null;
  }
  return mapHookEvent(event ?? {});
}

async function main() {
  let event;
  try { event = JSON.parse((await readStdin()) || '{}'); } catch { return; }
  const dir = process.env.TEAM_ROOM_DIR || process.cwd();
  touchHeartbeat(dir); // signal "hooks are live here" so the desktop watcher won't double-post
  const activity = toActivity(event);
  if (!activity) return;
  const marker = readMarker(dir);
  if (!marker) return; // not connected → private (default)
  await postActivity(marker, activity);
}
main();
