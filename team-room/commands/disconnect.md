---
description: Stop streaming this session to the Team Room and end the session.
allowed-tools: Bash
---

# Disconnect from the Team Room

Stop streaming the current session:

1. Read the marker to get the room + session: `cat .team-room/connection.json`. If the file does not exist, tell the user this session isn't connected and stop here.

2. Call the **`leave_room`** tool (from the `team-room` connector) with `room` = the marker's `room` field and `sessionId` = the marker's `sessionId`, to end the session.

3. Remove the marker so capture stops: `rm -f .team-room/connection.json`

4. Confirm to the user that the session has ended and activity is no longer streaming.
