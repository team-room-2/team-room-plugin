#!/bin/sh
# Team Room inbox hook. Bootstraps node, then injects unread room messages into the agent's context.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(CDPATH= cd "$(dirname "$0")/.." && pwd)}"
exec sh "$ROOT/with-node.sh" node "$ROOT/hooks/check-inbox.mjs"
