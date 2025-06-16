# Persistent SSH Sessions for a Single User

This design describes how to keep SSH sessions alive on the backend even when the WebSocket connection closes. The server runs for a single trusted user, so there is no account system. A lightweight password check guards access to the terminal.

## 1. Simple Password Check

- Set an `APP_PASSWORD` environment variable when starting the server.
- When a user opens the web page, the browser prompts for this password.
- If the password matches, start the session and set a cookie so future connections skip the prompt until logout.
- If the provided password does not match `APP_PASSWORD`, the server rejects the connection.

## 2. Session Store

- Keep the active `ssh2` Client and its `sessionId` in memory.
- Because there is only one user, we track a single session at a time.

## 3. WebSocket Connection Handling

1. When the browser connects to `/terminal`, first check for an auth cookie and a provided `sessionId` parameter.
2. If the `sessionId` exists in the session store, attach the WebSocket to the existing shell stream.
3. If no valid session exists, prompt for the password (unless already authenticated), then create a new SSH connection and generate a new `sessionId`. Store the auth cookie so future visits skip the prompt.
4. Send the `sessionId` back to the client so it can reconnect later.
5. When the WebSocket closes, keep the SSH connection open and keep buffering output in memory (or optionally write to a file) for that session.
6. Periodically clean up idle sessions after a configurable timeout.

## 4. Client Changes

- After the initial connection, the browser stores the issued `sessionId`.
- On page load or reconnect, the client automatically attempts to resume the existing session by sending the stored `sessionId` when opening the WebSocket.
- If the session has expired or been cleaned up, the client falls back to creating a new one after prompting for credentials.

## 5. History and Buffering

- The backend should buffer terminal output while the client is disconnected.
- On reconnection, send the buffered history to the client so it can render the missing output.
- Optionally cap the buffer size or persist to disk to prevent memory growth.

## 6. Cleanup Strategy

- Track the last active timestamp for each session.
- A background job periodically removes sessions that have been idle for longer than the configured timeout (e.g., 30 minutes).

This approach keeps SSH sessions alive independently from browser connections. A single password allows the server owner to reconnect from any device and resume the existing terminal state without re-authenticating to the remote host.
