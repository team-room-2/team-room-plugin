#!/bin/sh
# Install the Team Room desktop-capture daemon as a launchd agent (auto-start + keepalive).
#   Install:    sh install.sh
#   Uninstall:  sh install.sh uninstall
# The daemon streams Claude Code DESKTOP sessions (which run no hooks) to the room. On the CLI,
# where the plugin's hooks already stream, it stands down automatically. Safe to run with or
# without the plugin installed.
set -e
DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"      # .../team-room/daemon
LABEL="com.team-room.daemon"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/.team-room/daemon.log"
UID_NUM="$(id -u)"

if [ "$1" = "uninstall" ]; then
  launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Team Room daemon uninstalled."
  exit 0
fi

mkdir -p "$HOME/.team-room" "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$DIR/run-daemon.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>StandardOutPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_EOF

launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST" 2>/dev/null || launchctl load "$PLIST"
echo "Team Room daemon installed + started."
echo "  log:       $LOG"
echo "  uninstall: sh \"$DIR/install.sh\" uninstall"
