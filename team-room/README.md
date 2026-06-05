# team-room (Claude Code plugin)

Streams your Claude Code activity into a shared live room — see your team's in-flight agent work before it's a commit. Works in the CLI and the desktop app.

**Install:** `/plugin marketplace add team-room-2/team-room-plugin` then `/plugin install team-room`

**Use:** `/team-room:connect <room>` to start streaming · `/team-room:disconnect` to stop.

Capture is opt-in per session (default private) and authenticated by a short-lived, session-scoped write-token kept in a gitignored `.team-room/connection.json`. CLI uses hooks; the desktop app uses the bundled transcript watcher (a local MCP server) — they never double-post.

See the [repository README](https://github.com/team-room-2/team-room-plugin) for the full design, the write-token model, and privacy.
