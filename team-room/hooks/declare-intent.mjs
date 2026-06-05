#!/usr/bin/env node
// PreToolUse (Layer 2). Before an edit, declare intent on the file via POST /api/intent with the
// session write-token, which detects collisions server-side. If a collision is reported, surface a
// warning to the agent's context (non-blocking in v1 — Layer 3 adds the yield). No marker → silent.
import { readMarker, editTargetPath } from '../lib/team-room-core.mjs';

function readStdin() {
  process.stdin.setEncoding('utf8');
  return new Promise((res) => { let b = ''; process.stdin.on('data', (c) => (b += c)); process.stdin.on('end', () => res(b)); });
}

async function main() {
  let event; try { event = JSON.parse((await readStdin()) || '{}'); } catch { return; }
  const sid = event.session_id || process.env.CLAUDE_CODE_SESSION_ID;
  const path = editTargetPath(event);
  if (!sid || !path) return;
  const marker = readMarker(sid);
  if (!marker || !marker.apiUrl || !marker.token) return;
  let collision = null;
  try {
    const res = await fetch(`${marker.apiUrl}/api/intent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${marker.token}` },
      body: JSON.stringify({ path }),
    });
    if (res.ok) { const d = await res.json(); collision = d.collision ?? null; }
  } catch { /* best-effort */ }
  if (collision) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: `⚠️ Team Room: another agent is already working in ${path}. Consider coordinating before you edit.` } }));
  }
}
main();
