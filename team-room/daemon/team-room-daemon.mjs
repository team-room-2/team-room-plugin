#!/usr/bin/env node
// Standalone background capture for the Claude Code DESKTOP app — which runs no hooks and no
// local MCP servers, so it can't host the per-session watcher the way the CLI does. This daemon
// (run under launchd) scans ~/.claude/projects for ACTIVE sessions; for any whose project cwd has
// a .team-room/connection.json marker, it tails the transcript and streams activity to the room.
// On the CLI, where the plugin's hooks already stream instantly, it stands down per-project via
// the hook heartbeat — so the daemon and the hooks never double-post. Pure Node, no deps; reuses
// the plugin's capture core (same parser + POST as the hooks/watcher).
import { readFileSync, statSync, openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readMarker, postActivity, parseTranscriptRow, heartbeatFresh } from '../lib/team-room-core.mjs';

const PROJECTS = join(homedir(), '.claude', 'projects');
const POLL_MS = Number(process.env.TEAM_ROOM_POLL_MS || 1500);
const ACTIVE_MS = Number(process.env.TEAM_ROOM_ACTIVE_MS || 10 * 60 * 1000); // ignore stale transcripts

const tracked = new Map(); // transcriptFile -> { cwd, offset, seen:Set }

// Claude Code records the session's cwd on assistant/attachment lines — read it so we can find
// that project's .team-room marker (the marker lives in the project dir, not under ~/.claude).
function cwdOf(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const s = line.trim(); if (!s) continue;
      try { const r = JSON.parse(s); if (typeof r.cwd === 'string') return r.cwd; } catch { /* */ }
    }
  } catch { /* */ }
  return null;
}

// Read only the bytes after offset, up to the last complete line (partial-line-safe).
function readNew(file, st) {
  let fd; try { fd = openSync(file, 'r'); } catch { return ''; }
  try {
    const size = fstatSync(fd).size;
    if (size < st.offset) st.offset = 0;          // rotated/truncated
    if (size === st.offset) return '';
    const b = Buffer.allocUnsafe(size - st.offset);
    readSync(fd, b, 0, size - st.offset, st.offset);
    const nl = b.lastIndexOf(0x0a);
    if (nl < 0) return '';                          // only a partial line so far
    st.offset += nl + 1;
    return b.subarray(0, nl + 1).toString('utf8');
  } catch { return ''; } finally { try { closeSync(fd); } catch { /* */ } }
}

async function tick() {
  let dirs; try { dirs = await readdir(PROJECTS); } catch { return; }
  for (const dir of dirs) {
    let files; try { files = await readdir(join(PROJECTS, dir)); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const file = join(PROJECTS, dir, f);
      let mtime; try { mtime = statSync(file).mtimeMs; } catch { continue; }
      if (Date.now() - mtime > ACTIVE_MS) continue;        // inactive session — skip
      let st = tracked.get(file);
      if (!st) {                                           // first sight: cache cwd, start at EOF
        let offset = 0; try { offset = statSync(file).size; } catch { /* */ }
        tracked.set(file, { cwd: cwdOf(file), offset, seen: new Set() });
        continue;
      }
      if (!st.cwd) { st.cwd = cwdOf(file); if (!st.cwd) continue; }
      const marker = readMarker(st.cwd);                   // re-read each tick (connect/disconnect)
      if (!marker) continue;                               // project not connected
      if (heartbeatFresh(st.cwd)) continue;                // CLI hooks own this project — stand down
      const chunk = readNew(file, st);
      if (!chunk) continue;
      for (const line of chunk.split('\n')) {
        const s = line.trim(); if (!s) continue;
        let r; try { r = JSON.parse(s); } catch { continue; }
        const id = r.uuid || r.id; if (id) { if (st.seen.has(id)) continue; st.seen.add(id); }
        for (const a of parseTranscriptRow(r)) await postActivity(marker, a);
      }
    }
  }
}

process.stderr.write(`[team-room-daemon] started — watching ${PROJECTS} (poll ${POLL_MS}ms)\n`);
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
for (;;) { await tick(); await new Promise((r) => setTimeout(r, POLL_MS)); }
