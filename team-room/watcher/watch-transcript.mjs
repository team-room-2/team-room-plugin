#!/usr/bin/env node
// Universal capture by tailing the session transcript — the path that works where hooks can't
// run (the desktop app). Polls THIS project's active Claude Code transcript, parses each new
// line into room activities, and POSTs them with the write-token from the local marker. On the
// CLI, the plugin's hooks already stream instantly, so the watcher LATCHES OFF the moment it
// sees a fresh hook heartbeat — it never double-posts. Pure Node, no deps. Exported as
// runWatch() for the MCP wrapper; runnable standalone (the daemon fallback / manual test).
import { statSync, existsSync, openSync, readSync, closeSync, fstatSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { readMarker, postActivity, parseTranscriptRow, heartbeatFresh } from '../lib/team-room-core.mjs';

const POLL_MS = Number(process.env.TEAM_ROOM_POLL_MS || 1000);
const STALE_MS = 5 * 60 * 1000; // at startup, ignore a transcript not written within this window

// Claude Code stores transcripts at ~/.claude/projects/<encoded-cwd>/<session>.jsonl, where the
// dir is the absolute cwd with every non-alphanumeric replaced by '-'.
function projectDir(cwd) {
  return join(homedir(), '.claude', 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
}
async function newestIn(dir) {
  let best = null, bestM = 0, files;
  try { files = await readdir(dir); } catch { return null; }
  for (const f of files) {
    if (!f.endsWith('.jsonl')) continue;
    const p = join(dir, f);
    try { const m = statSync(p).mtimeMs; if (m > bestM) { bestM = m; best = p; } } catch { /* */ }
  }
  return best ? { path: best, mtimeMs: bestM } : null;
}
// Resolve THIS project's active transcript ONLY — never fall back to another project/session
// (that would stream an unrelated session to this room — a correctness + privacy bug). Require
// it to have been written recently, so a stale transcript from a prior session isn't picked up.
async function resolveTranscript(fileArg, cwd, floorMs) {
  if (fileArg && existsSync(fileArg)) return fileArg;
  const newest = await newestIn(projectDir(cwd));
  return newest && newest.mtimeMs >= floorMs ? newest.path : null;
}

// Read only the bytes after `offset`, and only up to the LAST complete line — so a row that's
// still mid-append (no trailing newline yet) is left for the next poll, never dropped.
function readNewLines(file, offset) {
  let fd;
  try { fd = openSync(file, 'r'); } catch { return null; }
  try {
    const size = fstatSync(fd).size;
    if (size < offset) offset = 0;               // rotated/truncated → re-read
    if (size === offset) return { chunk: '', next: offset };
    const b = Buffer.allocUnsafe(size - offset);
    readSync(fd, b, 0, size - offset, offset);
    const nl = b.lastIndexOf(0x0a);
    if (nl < 0) return { chunk: '', next: offset }; // only a partial line so far — wait for more
    return { chunk: b.subarray(0, nl + 1).toString('utf8'), next: offset + nl + 1 };
  } catch { return null; }
  finally { try { closeSync(fd); } catch { /* */ } }
}

function activitiesFrom(chunk, seen) {
  const acts = [];
  for (const line of chunk.split('\n')) {
    const s = line.trim(); if (!s) continue;
    let row; try { row = JSON.parse(s); } catch { continue; }
    const id = row.uuid || row.id;
    if (id) { if (seen.has(id)) continue; seen.add(id); }
    for (const a of parseTranscriptRow(row)) acts.push(a);
  }
  return acts;
}

export async function runWatch({ cwd = process.env.TEAM_ROOM_DIR || process.cwd(), fileArg = null, log = () => {}, onState = () => {} } = {}) {
  const startedAt = Date.now();
  const seen = new Set();
  let posted = 0, fails = 0, lastError = null, hooksOwn = false;
  let marker = readMarker(cwd);
  let file = await resolveTranscript(fileArg, cwd, startedAt - STALE_MS);
  let offset = 0;
  if (file) { try { offset = statSync(file).size; } catch { /* */ } } // start at EOF — only new activity
  onState({ file, marker: !!marker, posted });
  log(`watching cwd=${cwd} file=${file || '(resolving)'} marker=${marker ? 'present' : 'waiting for /connect'}`);
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (!marker) { marker = readMarker(cwd); if (marker) { onState({ marker: true }); log('connected — streaming'); } else continue; }
    if (!hooksOwn && heartbeatFresh(cwd)) { hooksOwn = true; onState({ standby: true }); log('CLI hooks active — watcher standing down for this session'); }
    if (hooksOwn) continue;                        // CLI: hooks own capture — never double-post
    if (!file) { file = await resolveTranscript(fileArg, cwd, startedAt - STALE_MS); if (file) { onState({ file }); try { offset = statSync(file).size; } catch { /* */ } } continue; }
    const r = readNewLines(file, offset);
    if (r === null) { file = null; continue; }     // vanished/unreadable → re-resolve
    offset = r.next;
    if (!r.chunk) continue;
    for (const a of activitiesFrom(r.chunk, seen)) {
      if (await postActivity(marker, a)) { posted++; fails = 0; lastError = null; }
      else if (++fails >= 3) lastError = 'posts failing — token may be expired; re-run /team-room:connect';
    }
    onState({ posted, lastError });
  }
}

// Standalone entry (daemon fallback / manual test): `node watch-transcript.mjs [--file=PATH]`
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const fileArg = (process.argv.slice(2).find((a) => a.startsWith('--file=')) || '').slice('--file='.length) || null;
  runWatch({ fileArg, log: (m) => process.stderr.write(m + '\n') });
}
