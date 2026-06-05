---
description: Connect this Claude Code session to a Team Room so your activity streams live.
argument-hint: <room-name> [--private]
allowed-tools: Bash
---

# Connect to a Team Room

Parse `$ARGUMENTS`: the **room name** is the first word (if none given, use `checkout-app`); if the arguments contain `--private` or `--restricted`, the session is restricted (viewable only by its named audience), otherwise it's public within the room.

Do exactly this, in order:

1. Call the **`connect_room`** tool (from the `team-room` connector) with:
   - `room`: the room name parsed above
   - `label`: a short human label for this session — the current task or the repo name
   - `visibility`: `restricted` if `--private`/`--restricted` was given, otherwise `public`

2. The tool returns `{ session, writeToken }` (`session` has `id` and `roomId`). Persist a **per-session** marker so capture authenticates THIS session only — the filename uses `$CLAUDE_CODE_SESSION_ID`, so each session maps to its own room lane. Run this Bash, substituting the real values from the tool result:

   ```bash
   mkdir -p ~/.team-room/sessions && cat > ~/.team-room/sessions/"$CLAUDE_CODE_SESSION_ID".json <<'JSON'
   {"sessionId":"<session.id>","roomId":"<session.roomId>","token":"<writeToken>","apiUrl":"https://team-room.vercel.app","room":"<room-name>"}
   JSON
   ```
   The marker lives outside the repo, so the token is never committed — **no `.gitignore` change needed.**

3. Confirm to the user that their prompts, file edits, and replies now stream to the room, and give the live link: `https://team-room.vercel.app/room/<session.roomId>`

**Never print the write-token to the user** — it authorizes appending activity to this session.
