# team-room (Claude Code plugin)

Streams your Claude Code activity into a shared live room — see your team's in-flight agent work before it's a commit. Works in the CLI and the desktop app.

**Install:** `/plugin marketplace add team-room-2/team-room-plugin` then `/plugin install team-room`

**Use:** `/team-room:connect <room>` to start streaming · `/team-room:disconnect` to stop.

Capture is opt-in per session (default private) and authenticated by a short-lived, session-scoped write-token. Each `/connect` writes a **per-session** marker at `~/.team-room/sessions/<session-id>.json` — keyed by the Claude Code session id, so two sessions in the same folder stream to two separate room lanes (never merged), and the token lives outside any repo (nothing to gitignore). CLI uses hooks; the desktop app uses a small background daemon (launchd) that tails the session transcript — they coordinate via a per-session heartbeat so they never double-post.

See the [repository README](https://github.com/team-room-2/team-room-plugin) for the full design, the write-token model, and privacy.
