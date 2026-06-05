import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editTargetPath } from '../lib/team-room-core.mjs';

test('editTargetPath returns path for Edit', () => {
  assert.equal(editTargetPath({ tool_name: 'Edit', tool_input: { file_path: 'lib/cart.ts' } }), 'lib/cart.ts');
});
test('editTargetPath null for non-edit tools', () => {
  assert.equal(editTargetPath({ tool_name: 'Bash', tool_input: { command: 'ls' } }), null);
});
