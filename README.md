# Team Room — Claude Code plugin

**See your team's agents at work, live — before it becomes a commit.**

GitHub syncs the code; the Team Room syncs the *intent*. Install this plugin and your Claude Code activity — prompts, file edits, replies — streams into a shared live room, so you and your collaborators can see each other's in-flight work as it happens (and catch a collision before it becomes a merge conflict).

Works in **both the Claude Code CLI and the desktop app.**

## Install

```
/plugin marketplace add team-room-2/team-room-plugin
/plugin install team-room
```

On first use you'll be prompted to **sign in** (WorkOS/AuthKit — GitHub, Google, or email). That's the hosted connector registering itself; there's no manual "Add custom connector" step.

> If you previously added a "Team Room" custom connector by hand, remove it (Settings → Connectors) so you don't get a duplicate — this plugin adds it for you.

## Use

```
/team-room:connect <room>      # join a room — start streaming this session
/team-room:disconnect          # stop streaming and end the session
```

The connect step prints your live view link: **`https://team-room.vercel.app/room/<room-id>`**.

Streaming is **opt-in per session** — nothing leaves your machine until you run `/team-room:connect`, and `/team-room:disconnect` stops it.

## How it works

- **Connector** (`team-room`, hosted at `team-room.vercel.app/api/mcp`) — OAuth identity + the room tools (`connect_room`, `whoami`, `get_recent_activity`, `set_current_target`, `leave_room`). Auto-added by the plugin; no manual setup.
- **`/connect`** mints a short-lived, **session-scoped write-token** and drops a local marker (`.team-room/connection.json`, gitignored) — the only thing capture needs to authenticate.
- **Capture** (two paths, one mechanism each per surface, no double-posting):
  - **CLI** — hooks stream each prompt / file action / reply the instant it happens.
  - **Desktop** — a lightweight watcher (a local MCP server the plugin ships) tails the session transcript and streams it, since the desktop app doesn't run hooks. The watcher stands down whenever the CLI hooks are active, so they never double-post.

The write-token can only **append activity to one session**, and it expires — a leaked marker can't impersonate you. Re-run `/team-room:connect` to re-mint if a long session outlives its token.

## Privacy

- Opt-in per session; **default private**. No marker → nothing streams.
- The marker holds a scoped, expiring token (not your account credentials) and is gitignored.
- Capture scripts are self-contained (no backend source, no extra dependencies) and only talk to the hosted Team Room API.

## Layout

```
.claude-plugin/marketplace.json     # this repo is its own marketplace
team-room/                          # the plugin
├── .claude-plugin/plugin.json
├── .mcp.json                       # hosted connector (http) + local capture server (stdio)
├── hooks/                          # CLI capture: hooks.json + run.sh + stream-activity.mjs
├── watcher/                        # desktop capture: the MCP watcher that tails the transcript
├── lib/team-room-core.mjs          # shared, dependency-free capture core
└── commands/                       # /team-room:connect, /team-room:disconnect
```

---

*A David + Natalia build. The app/backend lives in a separate private repo; this repo is just the installable plugin and its marketplace.*
