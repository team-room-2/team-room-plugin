// team-room-core.mjs — self-contained capture core for the Team Room plugin.
// Shared by the CLI hook (hooks/stream-activity.mjs) and the desktop watcher
// (watcher/watch-transcript.mjs). Zero dependencies beyond the Node stdlib; it talks
// only to the hosted Team Room API. Mirrors the app repo's hooks/ logic, ported to ESM.

import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const MAX = 500; // summary cap — matches the server's activityIngestSchema (.max(500))

// ── marker (.team-room/connection.json), written by the /connect command ──────────────
// Shape: { sessionId, token, apiUrl }  (token = the session-scoped write-token)
export function readMarker(cwd) {
  try { return JSON.parse(readFileSync(join(cwd, '.team-room', 'connection.json'), 'utf8')); }
  catch { return null; }
}

// ── POST one activity to the hosted room with the write-token ─────────────────────────
export async function postActivity(marker, activity) {
  if (!marker || !marker.apiUrl || !marker.token) return false;
  try {
    const res = await fetch(`${marker.apiUrl}/api/activity`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${marker.token}` },
      body: JSON.stringify({ ...activity, sessionId: marker.sessionId }),
    });
    return res.ok;
  } catch { return false; }
}

// ── hooks heartbeat ───────────────────────────────────────────────────────────────────
// The CLI hooks touch this (per project cwd) on every event. The desktop watcher checks it
// and STANDS DOWN whenever it's fresh — so on the CLI, where hooks already stream instantly,
// the watcher never double-posts. On the desktop app (no hooks) the heartbeat stays absent,
// so the watcher captures. Lives in the temp dir, keyed by a hash of the project path.
function heartbeatPath(cwd) {
  return join(tmpdir(), `team-room-hb-${createHash('sha1').update(cwd).digest('hex').slice(0, 16)}`);
}
export function touchHeartbeat(cwd) {
  try { writeFileSync(heartbeatPath(cwd), String(Date.now())); } catch { /* best-effort */ }
}
export function heartbeatFresh(cwd, maxAgeMs = 60000) {
  try { return Date.now() - statSync(heartbeatPath(cwd)).mtimeMs < maxAgeMs; } catch { return false; }
}

// ── hook events → activity (CLI path; mirrors hooks/map-activity.ts) ───────────────────
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
function toolActivity(ev, phase) {
  if (!ev.tool_name) return null;
  const fp = typeof ev.tool_input?.file_path === 'string' ? ev.tool_input.file_path : undefined;
  const mark = phase === 'start' ? '→' : '✓';
  if (EDIT_TOOLS.has(ev.tool_name) && fp)
    return { kind: 'file_edit', targetPath: fp, summary: `${mark} ${ev.tool_name} ${fp}`, phase };
  if (ev.tool_name === 'Read' && fp)
    return { kind: 'file_read', targetPath: fp, summary: `${mark} Read ${fp}`, phase };
  return { kind: 'tool_use', summary: `${mark} ${ev.tool_name}`, phase };
}

export function mapHookEvent(ev) {
  switch (ev.hook_event_name ?? 'PostToolUse') {
    case 'UserPromptSubmit': return ev.prompt ? { kind: 'prompt', summary: ev.prompt.slice(0, MAX) } : null;
    case 'PreToolUse': return toolActivity(ev, 'start');
    case 'PostToolUse': return toolActivity(ev, 'end');
    default: return null; // Stop is handled by the caller (needs the transcript)
  }
}

// ── transcript rows → activities (watcher path) ───────────────────────────────────────
// Works for BOTH the CLI's ~/.claude/projects/*.jsonl AND the desktop app's audit.jsonl —
// both carry { type, message: { role, content } }; audit.jsonl just adds _audit_* fields.
function textOf(blocks) {
  return blocks.filter((b) => b && b.type === 'text').map((b) => b.text || '').join('\n').trim();
}
// Tool-injected/synthetic user turns are wrapped in tags like <command-name>… or
// <local-command-stdout>… — skip those, but keep real prompts (even ones that start with '<',
// e.g. someone pasting "<div>"). Match the known synthetic markers, not any leading '<'.
const SYNTHETIC = /^<(command-name|command-message|command-args|local-command-stdout|local-command-stderr|user-prompt-submit-hook|system-reminder)\b/;
export function parseTranscriptRow(row) {
  const out = [];
  const m = row && row.message;
  if (!m) return out;
  const c = m.content;
  if (row.type === 'user' && m.role === 'user') {
    let text = null;
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c)) {
      if (c.some((b) => b && b.type === 'tool_result')) return out; // tool results aren't prompts
      text = textOf(c);
    }
    text = (text || '').trim();
    if (text && !SYNTHETIC.test(text)) out.push({ kind: 'prompt', summary: text.slice(0, MAX) });
  } else if (row.type === 'assistant' && m.role === 'assistant') {
    if (typeof c === 'string') {
      const t = c.trim();
      if (t) out.push({ kind: 'agent_message', summary: t.slice(0, MAX) });
    } else if (Array.isArray(c)) {
      for (const b of c) {
        if (!b) continue;
        if (b.type === 'tool_use') {
          const fp = typeof b.input?.file_path === 'string' ? b.input.file_path : undefined;
          if (EDIT_TOOLS.has(b.name) && fp) out.push({ kind: 'file_edit', targetPath: fp, summary: `✎ ${b.name} ${fp}` });
          else if (b.name === 'Read' && fp) out.push({ kind: 'file_read', targetPath: fp, summary: `○ Read ${fp}` });
          else if (b.name) out.push({ kind: 'tool_use', summary: `• ${b.name}` });
        } else if (b.type === 'text') {
          const t = (b.text || '').trim();
          if (t) out.push({ kind: 'agent_message', summary: t.slice(0, MAX) });
        }
        // thinking blocks → skipped (internal reasoning, not for the room)
      }
    }
  }
  return out;
}

// ── last assistant text from a transcript (CLI Stop hook; mirrors hooks/extract-reply.ts) ─
export function lastAssistantText(jsonl) {
  const lines = jsonl.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let row;
    try { row = JSON.parse(lines[i]); } catch { continue; }
    const msg = row?.message;
    if (row?.type !== 'assistant' && msg?.role !== 'assistant') continue;
    const content = msg?.content ?? row?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) { const t = textOf(content); if (t) return t; }
  }
  return null;
}
