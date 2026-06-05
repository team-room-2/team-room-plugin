#!/bin/sh
# Launches the Team Room desktop-capture daemon (bootstraps node first, like the hooks/watcher).
# $0 is .../team-room/daemon/run-daemon.sh → ROOT is the plugin's team-room/ dir.
ROOT="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
exec sh "$ROOT/with-node.sh" node "$ROOT/daemon/team-room-daemon.mjs"
