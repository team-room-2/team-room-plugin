import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapHookEvent, parseTranscriptRow, lastAssistantText } from '../lib/team-room-core.mjs';

// ── hook-event mapping (CLI path) ──────────────────────────────────────────────────────
test('mapHookEvent: PostToolUse Edit → file_edit (end)', () => {
  assert.deepEqual(mapHookEvent({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'lib/cart.ts' } }),
    { kind: 'file_edit', targetPath: 'lib/cart.ts', summary: '✓ Edit lib/cart.ts', phase: 'end' });
});
test('mapHookEvent: PreToolUse Read → file_read (start)', () => {
  assert.deepEqual(mapHookEvent({ hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'app/page.tsx' } }),
    { kind: 'file_read', targetPath: 'app/page.tsx', summary: '→ Read app/page.tsx', phase: 'start' });
});
test('mapHookEvent: other tool → tool_use, no path', () => {
  assert.deepEqual(mapHookEvent({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } }),
    { kind: 'tool_use', summary: '✓ Bash', phase: 'end' });
});
test('mapHookEvent: UserPromptSubmit → prompt', () => {
  assert.deepEqual(mapHookEvent({ hook_event_name: 'UserPromptSubmit', prompt: 'add discount codes' }),
    { kind: 'prompt', summary: 'add discount codes' });
});
test('mapHookEvent: no tool_name → null', () => assert.equal(mapHookEvent({ hook_event_name: 'PostToolUse' }), null));

// ── transcript-row mapping (watcher path; CLI + desktop audit.jsonl) ───────────────────
test('parseTranscriptRow: user string → prompt', () => {
  assert.deepEqual(parseTranscriptRow({ type: 'user', message: { role: 'user', content: 'Yes this is perfect' } }),
    [{ kind: 'prompt', summary: 'Yes this is perfect' }]);
});
test('parseTranscriptRow: assistant Read tool_use → file_read', () => {
  assert.deepEqual(parseTranscriptRow({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/x/MEMORY.md' } }] } }),
    [{ kind: 'file_read', targetPath: '/x/MEMORY.md', summary: '○ Read /x/MEMORY.md' }]);
});
test('parseTranscriptRow: assistant text → agent_message', () => {
  assert.deepEqual(parseTranscriptRow({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Let me start' }] } }),
    [{ kind: 'agent_message', summary: 'Let me start' }]);
});
test('parseTranscriptRow: thinking → skipped', () => {
  assert.deepEqual(parseTranscriptRow({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'hmm' }] } }), []);
});
test('parseTranscriptRow: user tool_result → skipped (not a prompt)', () => {
  assert.deepEqual(parseTranscriptRow({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } }), []);
});
test('parseTranscriptRow: synthetic <...> prompt → skipped', () => {
  assert.deepEqual(parseTranscriptRow({ type: 'user', message: { role: 'user', content: '<command-name>/clear</command-name>' } }), []);
});
test('parseTranscriptRow: mixed text + tool_use → both, in order', () => {
  assert.deepEqual(parseTranscriptRow({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Editing' }, { type: 'tool_use', name: 'Write', input: { file_path: 'a.ts' } }] } }),
    [{ kind: 'agent_message', summary: 'Editing' }, { kind: 'file_edit', targetPath: 'a.ts', summary: '✎ Write a.ts' }]);
});

// ── last assistant text (CLI Stop hook) ────────────────────────────────────────────────
test('lastAssistantText: returns the final assistant text', () => {
  const jsonl = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'first' }] } }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'final answer' }] } }),
  ].join('\n');
  assert.equal(lastAssistantText(jsonl), 'final answer');
});
