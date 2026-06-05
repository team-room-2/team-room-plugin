#!/bin/sh
# Team Room declare-intent hook. Bootstraps node, then declares file intent + checks for collisions.
ROOT="${CLAUDE_PLUGIN_ROOT:-$(CDPATH= cd "$(dirname "$0")/.." && pwd)}"
exec sh "$ROOT/with-node.sh" node "$ROOT/hooks/declare-intent.mjs"
