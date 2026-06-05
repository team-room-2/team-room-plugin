#!/usr/bin/env node
// Universal capture by tailing the session transcript — the path that works where hooks can't
// run (the desktop app). Polls the active Claude Code transcript, parses each new line into
// room activities, and POSTs them with the write-token from the local marker. On the CLI, the
// plugin's hooks already stream (instantly + precisely), so this watcher SKIPS posting whenever
// a fresh hook heartbeat is present — no double-capture. Pure Node, no deps. Exported as
// runWatch() for the MCP wrapper; runnable standalone (the daemon fallback / manual test).
import { readFileSync, statSync, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { readMarker, postActivity, parseTranscriptRow, heartbeatFresh } from '../lib/team-room-core.mjs';

const POLL_MS = Number(process.env.TEAM_ROOM_POLL_MS || 1000);

// Claude Code stores transcripts at ~/.claude/projects/<encoded-cwd>/<session>.jsonl, where the
// dir is the absolute cwd with every non-alphanumeric replaced by '-'. Target THIS project's
// dir first (precise — the active session), else fall back to the newest transcript anywhere.
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
  return best;
}
async function globalNewest() {
  const base = join(homedir(), '.claude', 'projects');
  let best = null, bestM = 0, dirs;
  try { dirs = await readdir(base); } catch { return null; }
  for (const d of dirs) {
    const p = await newestIn(join(base, d));
    if (p) { try { const m = statSync(p).mtimeMs; if (m > bestM) { bestM = m; best = p; } } catch { /* */ } }
  }
  return best;
}
async function resolveTranscript(fileArg, cwd) {
  if (fileArg && existsSync(fileArg)) return fileArg;
  return (await newestIn(projectDir(cwd))) || (await globalNewest());
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
  const seen = new Set();
  let posted = 0;
  let marker = readMarker(cwd);
  let file = await resolveTranscript(fileArg, cwd);
  let offset = 0;
  try { if (file) offset = statSync(file).size; } catch { /* */ } // start at EOF — stream only new activity
  onState({ file, marker: !!marker, posted });
  log(`watching file=${file || '(resolving)'} marker=${marker ? 'present' : 'waiting for /connect'}`);
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (!marker) { marker = readMarker(cwd); if (marker) { onState({ marker: true }); log('connected — streaming'); } else continue; }
    if (!file) { file = await resolveTranscript(fileArg, cwd); if (file) { onState({ file }); try { offset = statSync(file).size; } catch { /* */ } } continue; }
    let size; try { size = statSync(file).size; } catch { file = null; continue; }
    if (size < offset) offset = 0;      // rotated/rewritten → re-read (uuid dedup guards dupes)
    if (size === offset) continue;
    let buf; try { buf = readFileSync(file); } catch { continue; }
    const chunk = buf.subarray(offset).toString('utf8'); // byte-accurate slice (multibyte-safe)
    offset = buf.length;
    const acts = activitiesFrom(chunk, seen);
    if (!acts.length) continue;
    if (heartbeatFresh(cwd)) continue;  // CLI: hooks are already streaming — stand down
    for (const a of acts) { if (await postActivity(marker, a)) posted++; }
    onState({ posted });
  }
}

// Standalone entry (daemon fallback / manual test): `node watch-transcript.mjs [--file=PATH]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const fileArg = (process.argv.slice(2).find((a) => a.startsWith('--file=')) || '').slice('--file='.length) || null;
  runWatch({ fileArg, log: (m) => process.stderr.write(m + '\n') });
}
