---
description: Stop streaming this session to the Team Room and end the session.
allowed-tools: Bash
---

# Disconnect from the Team Room

Stop streaming the current session:

1. Read this session's marker: `cat ~/.team-room/sessions/"$CLAUDE_CODE_SESSION_ID".json`. If it doesn't exist, tell the user this session isn't connected and stop.

2. Call the **`leave_room`** tool (from the `team-room` connector) with `room` = the marker's `room` field and `sessionId` = the marker's `sessionId` field, to end the room session.

3. Remove the marker so capture stops: `rm -f ~/.team-room/sessions/"$CLAUDE_CODE_SESSION_ID".json`

4. Confirm to the user that the session has ended and activity is no longer streaming.
