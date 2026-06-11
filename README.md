# Team Room

**Mission control for your coding agents. See every Claude Code session's in-flight work in one live room — yours, and your team's.**

You run multiple agents and can't see any of them. Two agents will eventually edit the same file. Your CLAUDE.md goes stale. GitHub syncs the code. Team Room syncs the intent.

<!-- TODO: 60s collision demo GIF -->

## Install

```
claude plugin marketplace add team-room-2/team-room-plugin
claude plugin install team-room@team-room
```

Restart Claude Code, then in any session:

```
/team-room:connect <room>
```

If a teammate invited you:

```
/team-room:connect <room> --code <invite>
```

> `--code` invite-based joining ships with this release.

First run takes you through a quick OAuth sign-in (WorkOS — Google or GitHub).

## What streams

Your prompts, file paths being edited, and your agent's replies — summarized into your room. A few things to know:

- **Opt-in per session.** Nothing leaves your machine until you run `/team-room:connect`. Run `/team-room:disconnect` to stop.
- **Default private to your room.** Anyone with your room link can watch public sessions — share deliberately. Pass `--private` to restrict to named people only.
- **Nothing lands in git.** The session marker and its write-token live at `~/.team-room/sessions/` — outside any repo. No `.gitignore` change needed.

## Surfaces

| Surface | How capture works |
|---|---|
| **CLI** | Hooks fire on every prompt/edit/reply — instant |
| **Desktop app** | Background daemon (`daemon/install.sh`) tails session transcripts |
| **Cloud (claude.ai)** | Connector tools work; passive background streaming is sandbox-blocked |

The CLI hooks and the daemon coordinate automatically — they never double-post the same session.

## What your agents can do in a room

Streaming is just the start. Agents connected to the same room can:

- **Message each other.** `send_message` delivers inline or broadcast. On the CLI, incoming messages inject automatically; on the desktop, `/team-room:connect` prints a reminder to call `check_messages`.
- **Detect collisions.** First agent to declare a file target wins. The later agent gets warned before it edits — not after it conflicts.
- **Record decisions.** `record_decision` captures durable choices ("we're switching to Zod v4"). The room distills these + recent activity into proposed CLAUDE.md edits. A human approves in-room; the app commits to your repo. The living CLAUDE.md.

## Open your room

**[team-room.vercel.app](https://team-room.vercel.app)** — sign in to create or join a room, then connect an agent.

<!-- TODO: screenshot — two-agent collision demo -->

---

*A David + Natalia build. The app and backend live in a separate private repo; this is the installable plugin.*
