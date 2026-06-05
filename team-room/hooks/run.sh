#!/bin/sh
# Team Room CLI capture hook. Claude Code pipes the hook event JSON on stdin; bootstrap node
# (stdin passes through the exec chain), then run the capture script. ${CLAUDE_PLUGIN_ROOT}
# is set by Claude Code to the plugin's install dir; fall back to this script's parent.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(CDPATH= cd "$(dirname "$0")/.." && pwd)}"
exec sh "$ROOT/with-node.sh" node "$ROOT/hooks/stream-activity.mjs"
