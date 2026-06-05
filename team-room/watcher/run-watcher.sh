#!/bin/sh
# Launches the Team Room desktop watcher as a stdio MCP server — the one plugin entrypoint
# that the desktop app starts at session begin (hooks don't run there). Bootstrap node, then
# run the MCP+watch server, which speaks minimal MCP on stdio AND tails the session transcript.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(CDPATH= cd "$(dirname "$0")/.." && pwd)}"
exec sh "$ROOT/with-node.sh" node "$ROOT/watcher/mcp-watcher.mjs"
