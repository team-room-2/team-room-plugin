#!/bin/sh
# Node-PATH bootstrap for the Team Room plugin. Claude Code launches hooks and stdio MCP
# servers under /bin/sh, whose PATH frequently lacks a version-manager (nvm) node — so a bare
# `node` fails with "command not found". Put a usable node on PATH, then exec the command.
# (Self-contained copy of the app repo's scripts/with-node.sh, kept identical on purpose.)
#
# Usage: sh with-node.sh <command> [args...]
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh" >/dev/null 2>&1   # picks the `default` alias if set
fi
if ! command -v node >/dev/null 2>&1; then
  if [ -d "$NVM_DIR/versions/node" ]; then
    latest="$(ls -1 "$NVM_DIR/versions/node" 2>/dev/null | sort -V | tail -1)"
    [ -n "$latest" ] && PATH="$NVM_DIR/versions/node/$latest/bin:$PATH"
  fi
  PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  export PATH
fi
exec "$@"
