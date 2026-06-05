#!/usr/bin/env node
// Standalone background capture for the Claude Code DESKTOP app — which runs no hooks and no
// local MCP servers. This daemon (run under launchd) scans ~/.claude/projects for ACTIVE
// sessions; for any session that has a per-session marker (~/.team-room/sessions/<session-id>.json,
// written by /connect — the transcript filename IS the session id), it tails the transcript and
// streams activity to THAT session's room lane. On the CLI, where the plugin's hooks already
// stream, it stands down per-session via the hook heartbeat — so the daemon and the hooks never
// double-post. Pure Node, no deps; reuses the plugin's capture core.
import { statSync, openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readMarker, postActivity, parseTranscriptRow, heartbeatFresh } from '../lib/team-room-core.mjs';

const PROJECTS = join(homedir(), '.claude', 'projects');
const POLL_MS = Number(process.env.TEAM_ROOM_POLL_MS || 1500);
const ACTIVE_MS = Number(process.env.TEAM_ROOM_ACTIVE_MS || 10 * 60 * 1000); // ignore stale transcripts

const tracked = new Map(); // transcriptFile -> { offset, seen:Set }

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
      const sessionId = f.slice(0, -'.jsonl'.length);       // transcript filename === Claude Code session id
      let mtime; try { mtime = statSync(file).mtimeMs; } catch { continue; }
      if (Date.now() - mtime > ACTIVE_MS) continue;         // inactive session — skip
      const marker = readMarker(sessionId);                 // per-session marker (re-read each tick)
      if (!marker) continue;                                // this session isn't connected
      if (heartbeatFresh(sessionId)) continue;              // CLI hooks own this session — stand down
      let st = tracked.get(file);
      if (!st) {                                            // first sight after connect: start at EOF
        let offset = 0; try { offset = statSync(file).size; } catch { /* */ }
        tracked.set(file, { offset, seen: new Set() });
        continue;
      }
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
