#!/usr/bin/env node
// Minimal MCP stdio server whose real job is to host the transcript watcher. The desktop app
// launches a plugin's MCP servers at session start (hooks don't run there), so this is how the
// watcher gets started on the desktop. It speaks just enough of the MCP protocol to register
// cleanly and exposes one status tool, while running the watch loop in the background.
// Pure Node — no SDK dependency. (On the CLI it also launches, but stands down via the hook
// heartbeat, so it does nothing there except answer the status tool.)
import { runWatch } from './watch-transcript.mjs';

const SERVER = { name: 'team-room-capture', version: '0.1.0' };
const PROTOCOL = '2025-06-18';
let state = { file: null, marker: false, posted: 0 };

// ── newline-delimited JSON-RPC 2.0 over stdio ─────────────────────────────────────────
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (line) handle(line);
  }
});
const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

function statusText() {
  if (!state.marker) return `Idle — not connected. Run /team-room:connect <room> to start streaming. (transcript: ${state.file || 'resolving'})`;
  return `Streaming to the room · ${state.posted} activities sent · transcript: ${state.file || 'resolving'}`;
}

function handle(line) {
  let req; try { req = JSON.parse(line); } catch { return; }
  const { id, method, params } = req;
  switch (method) {
    case 'initialize':
      return reply(id, { protocolVersion: params?.protocolVersion || PROTOCOL, capabilities: { tools: {} }, serverInfo: SERVER });
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return; // notifications: no reply
    case 'tools/list':
      return reply(id, { tools: [{
        name: 'team_room_capture_status',
        description: 'Status of the Team Room desktop capture: which transcript it is tailing and how many activities it has streamed to the room.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      }] });
    case 'tools/call':
      if (params?.name === 'team_room_capture_status') return reply(id, { content: [{ type: 'text', text: statusText() }] });
      return fail(id, -32602, `Unknown tool: ${params?.name}`);
    case 'resources/list': return reply(id, { resources: [] });
    case 'prompts/list': return reply(id, { prompts: [] });
    case 'ping': return reply(id, {});
    default:
      if (id !== undefined) fail(id, -32601, `Method not found: ${method}`);
  }
}

// Start the watcher (reads the marker + tails the transcript). stdout stays clean for MCP;
// the watcher logs to stderr only.
runWatch({
  log: (m) => process.stderr.write('[team-room-capture] ' + m + '\n'),
  onState: (s) => { state = { ...state, ...s }; },
}).catch((e) => process.stderr.write('[team-room-capture] watcher error: ' + (e?.stack || e) + '\n'));

process.stderr.write('[team-room-capture] started\n');
