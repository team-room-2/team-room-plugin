---
description: Connect this Claude Code session to a Team Room so your activity streams live.
argument-hint: <room-name>
allowed-tools: Bash, Write
---

# Connect to a Team Room

Connect the current session to the Team Room named **$ARGUMENTS** (if empty, use `checkout-app`) so this agent's activity streams into the live room.

Do exactly this, in order:

1. Call the **`connect_room`** tool (from the `team-room` connector) with:
   - `room`: `$ARGUMENTS` (or `checkout-app` if empty)
   - `label`: a short human label for this session — the current task or the repo name
   - `visibility`: `public` (use `restricted` only if the user explicitly wants a named audience)

2. The tool returns `{ session, writeToken }`. Persist the connection marker so capture can authenticate. Use the **Write** tool to create `.team-room/connection.json` in the current working directory, with EXACTLY this shape (substitute the real values, and use the room name from step 1):

   ```json
   { "sessionId": "<session.id>", "token": "<writeToken>", "apiUrl": "https://team-room.vercel.app", "room": "<room-name>" }
   ```

3. Make sure the marker is gitignored (it holds a token). Run:
   `grep -qsxF '.team-room/' .gitignore || printf '\n.team-room/\n' >> .gitignore`

4. Confirm to the user: their prompts, file edits, and replies are now streaming to the room, and give them the live view link:
   `https://team-room.vercel.app/room/<session.roomId>`

**Never print the write-token to the user** — it is a secret that authorizes appending activity to this session.
