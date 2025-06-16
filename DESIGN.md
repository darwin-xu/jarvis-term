# Persistent SSH Sessions with User Management

This design describes how to enhance the existing Node.js-based SSH terminal tool to keep SSH sessions alive on the backend even when the WebSocket connection closes. Sessions will be associated with authenticated users so that they can reconnect and resume their terminals later.

## 1. User Management

- **User Accounts**: Store user credentials in a simple database (e.g., SQLite) or use an external identity provider.
- **Login Flow**: Add login and registration routes in Express. After authentication, issue a session cookie or token.
- **Authorization Middleware**: Protect the `/terminal` WebSocket endpoint so only logged-in users can create or attach to SSH sessions.

## 2. Session Store

- Maintain an in-memory map or persistent store that maps `sessionId` to an `ssh2` Client and shell stream.
- Each session is associated with the authenticated user ID.
- Optionally persist session metadata to disk so that server restarts can restore connections if supported.

## 3. WebSocket Connection Handling

1. When a user connects to `/terminal`, check for a provided `sessionId` parameter.
2. If the `sessionId` exists in the session store and belongs to the user, attach the WebSocket to the existing shell stream.
3. If no valid session exists, create a new SSH connection using the supplied host/user/pass and generate a new `sessionId`.
4. Send the `sessionId` back to the client so it can reconnect later.
5. When the WebSocket closes, keep the SSH connection open and keep buffering output in memory (or optionally write to a file) for that session.
6. Periodically clean up idle sessions after a configurable timeout.

## 4. Client Changes

- After a successful login, the browser stores the issued `sessionId`.
- On page load or reconnect, the client automatically attempts to resume the existing session by sending the stored `sessionId` when opening the WebSocket.
- If the session has expired or been cleaned up, the client falls back to creating a new one after prompting for credentials.

## 5. History and Buffering

- The backend should buffer terminal output while the client is disconnected.
- On reconnection, send the buffered history to the client so it can render the missing output.
- Optionally cap the buffer size or persist to disk to prevent memory growth.

## 6. Cleanup Strategy

- Track the last active timestamp for each session.
- A background job periodically removes sessions that have been idle for longer than the configured timeout (e.g., 30 minutes).

This approach keeps SSH sessions alive independently from browser connections and ties them to user accounts. Users can log in from multiple devices or after a page refresh and restore their existing terminal state without re-authenticating to the remote host.
