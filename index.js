const express = require('express');
const expressWs = require('express-ws');
const cookieParser = require('cookie-parser');
const { Client } = require('ssh2');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const APP_PASSWORD = process.env.APP_PASSWORD;
const SESSION_TIMEOUT_MS =
    (parseInt(process.env.SESSION_TIMEOUT_MIN, 10) || 30) * 60 * 1000;

const app = express();
expressWs(app);
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();

function log(...args) {
    console.log(new Date().toISOString(), ...args);
}

function cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastActive > SESSION_TIMEOUT_MS) {
            if (session.stream) {
                session.stream.end();
            }
            session.conn.end();
            sessions.delete(id);
            log(`Session ${id} timed out and was removed`);
        }
    }
}
setInterval(cleanupSessions, 60 * 1000);

app.post('/auth/login', (req, res) => {
    if (!APP_PASSWORD) {
        return res
            .status(500)
            .json({ error: 'Server password not configured' });
    }
    if (req.body.password === APP_PASSWORD) {
        res.cookie('auth', '1', { httpOnly: true });
        res.json({ ok: true });
    } else {
        res.status(401).json({ ok: false });
    }
});

app.post('/auth/logout', (req, res) => {
    res.clearCookie('auth');
    res.json({ ok: true });
});

app.get('/auth/check', (req, res) => {
    res.json({ authenticated: req.cookies.auth === '1' });
});

app.post('/sessions/terminate', (req, res) => {
    if (req.cookies.auth !== '1') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const { sessionId } = req.body || {};
    const session = sessions.get(sessionId);
    if (session) {
        if (session.stream) {
            session.stream.end();
        }
        session.conn.end();
        sessions.delete(sessionId);
        res.json({ ok: true });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

// Add endpoint for saving command output logs
app.post('/api/command-log', (req, res) => {
    if (req.cookies.auth !== '1') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { command, output, timestamp, executionTime, sessionId } =
            req.body;

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        const logEntry = {
            command,
            output: output || '',
            timestamp: timestamp || new Date().toISOString(),
            executionTime: executionTime || 0,
            sessionId: sessionId || 'unknown',
        };

        const fs = require('fs');
        const logFile = path.join(__dirname, 'command-logs.json');

        // Read existing logs
        let logs = [];
        try {
            if (fs.existsSync(logFile)) {
                const data = fs.readFileSync(logFile, 'utf8');
                logs = JSON.parse(data);
            }
        } catch (err) {
            log('Error reading command logs:', err);
        }

        // Add new log entry
        logs.push(logEntry);

        // Keep only last 1000 entries
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }

        // Write back to file
        fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

        log(`Command logged: ${command}`);
        res.json({ ok: true });
    } catch (error) {
        log('Error saving command log:', error);
        res.status(500).json({ error: 'Failed to save command log' });
    }
});

const PING_INTERVAL = 15000;

function attachToSession(ws, session, offset = 0) {
    ws.sentIndex = Math.max(0, offset);
    const sendBuffered = () => {
        while (ws.sentIndex < session.buffer.length) {
            ws.send(session.buffer[ws.sentIndex]);
            ws.sentIndex++;
        }
    };

    if (!session.onData) {
        session.onData = data => {
            const text = data.toString('utf8');
            session.buffer.push(text);
            if (session.buffer.length > 2000) {
                session.buffer.shift();
                if (session.ws && session.ws.sentIndex > 0) {
                    session.ws.sentIndex--;
                }
            }
            session.lastActive = Date.now();
            if (session.ws && session.ws.readyState === session.ws.OPEN) {
                session.ws.send(text);
                session.ws.sentIndex = session.buffer.length;
            }
        };
        session.stream.on('data', session.onData);
        session.stream.stderr.on('data', session.onData);
    }

    session.ws = ws;
    log(
        `WebSocket attached to session ${session.id} from ${ws._socket.remoteAddress}:${ws._socket.remotePort}`
    );

    let closed = false;
    function handleSshClose(reason) {
        if (closed) return;
        closed = true;
        log(
            `SSH session ${session.id} closed (${reason}) for ${session.username}@${session.host}:${session.port}`
        );
        clearInterval(pingInterval);
        session.lastActive = Date.now();
        sessions.delete(session.id);
        if (session.ws && session.ws.readyState === session.ws.OPEN) {
            session.ws.send(
                JSON.stringify({
                    type: 'error',
                    message: 'SSH session closed',
                })
            );
            session.ws.close();
        }
    }

    if (!session.sshListenersAdded) {
        session.stream.on('close', () => handleSshClose('stream close'));
        session.stream.on('exit', code =>
            handleSshClose(`stream exit ${code}`)
        );
        session.stream.on('end', () => handleSshClose('stream end'));
        session.stream.on('error', err =>
            log(`SSH stream error for session ${session.id}:`, err)
        );
        session.conn.on('close', () => handleSshClose('conn close'));
        session.conn.on('end', () => handleSshClose('conn end'));
        session.conn.on('error', err =>
            log(`SSH connection error for session ${session.id}:`, err)
        );
        session.sshListenersAdded = true;
    }

    ws.isAlive = true;

    const pingInterval = setInterval(() => {
        if (ws.readyState !== ws.OPEN) {
            clearInterval(pingInterval);
            return;
        }
        if (!ws.isAlive) {
            clearInterval(pingInterval);
            log(`Terminating stale WebSocket for session ${session.id}`);
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        try {
            log(`Ping WebSocket for session ${session.id}`);
            ws.send(JSON.stringify({ type: 'ping' }));
            session.lastActive = Date.now();
        } catch {
            // ignore errors during ping
        }
    }, PING_INTERVAL);

    ws.on('message', msg => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'pong') {
                ws.isAlive = true;
                session.lastActive = Date.now();
                log(`Received pong for session ${session.id}`);
            } else if (data.type === 'ping') {
                log(`Received ping from client for session ${session.id}`);
                ws.send(JSON.stringify({ type: 'pong' }));
            } else if (data.type === 'resize') {
                session.cols = data.cols || 80;
                session.rows = data.rows || 24;
                if (session.stream.setWindow) {
                    session.stream.setWindow(session.rows, session.cols);
                }
            } else if (data.type === 'data') {
                session.stream.write(data.data);
            }
        } catch {
            session.stream.write(msg);
        }
    });

    ws.on('close', (code, reason) => {
        log(
            `WebSocket for session ${session.id} closed code=${code} reason=${reason.toString()}`
        );
        session.ws = null;
        session.lastActive = Date.now();
        clearInterval(pingInterval);
    });

    ws.on('error', err => {
        log(
            `WebSocket error for session ${session.id} from ${ws._socket.remoteAddress}:${ws._socket.remotePort}:`,
            err
        );
        session.ws = null;
        session.lastActive = Date.now();
        clearInterval(pingInterval);
    });

    ws.send(
        JSON.stringify({
            type: 'ready',
            sessionId: session.id,
            message: 'ready',
        })
    );
    sendBuffered();
}

app.ws('/terminal', (ws, req) => {
    const { sessionId } = req.query;
    const offset = parseInt(req.query.since, 10) || 0;
    if (sessionId) {
        if (sessions.has(sessionId)) {
            const session = sessions.get(sessionId);
            log(
                `WebSocket reconnect from ${req.socket.remoteAddress}:${req.socket.remotePort} for session ${sessionId}`
            );
            attachToSession(ws, session, offset);
            return;
        } else {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    message: 'Invalid session ID',
                })
            );
            ws.close();
            return;
        }
    }

    if (req.cookies.auth !== '1') {
        ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
        ws.close();
        return;
    }

    const host = req.query.host || process.env.SSH_HOST;
    const username = req.query.user || process.env.SSH_USER;
    const password = req.query.pass || process.env.SSH_PASS;
    const port = parseInt(req.query.port, 10) || 22;

    log(
        `WebSocket connection from ${req.socket.remoteAddress}:${req.socket.remotePort} to SSH ${username}@${host}:${port}`
    );

    if (!host || !username || !password) {
        ws.send(
            JSON.stringify({
                type: 'error',
                message: 'Missing SSH credentials',
            })
        );
        ws.close();
        return;
    }

    const conn = new Client();
    const id = uuidv4();
    const session = {
        id,
        conn,
        stream: null,
        buffer: [],
        cols: 80,
        rows: 24,
        lastActive: Date.now(),
        host,
        port,
        username,
    };
    sessions.set(id, session);
    log(`Created SSH session ${id} for ${username}@${host}:${port}`);

    conn.on('ready', () => {
        log(
            `SSH connection ready for session ${id} to ${username}@${host}:${port}`
        );
        conn.shell(
            {
                term: 'xterm-256color',
                cols: session.cols,
                rows: session.rows,
            },
            (err, stream) => {
                if (err) {
                    ws.send(
                        JSON.stringify({
                            type: 'error',
                            message: 'Shell error: ' + err.message,
                        })
                    );
                    ws.close();
                    conn.end();
                    sessions.delete(id);
                    return;
                }
                session.stream = stream;
                attachToSession(ws, session);
            }
        );
    })
        .on('error', err => {
            log(
                `SSH connection error for session ${id} to ${username}@${host}:${port}:`,
                err
            );
            ws.send(
                JSON.stringify({
                    type: 'error',
                    message: 'Connection error: ' + err.message,
                })
            );
            ws.close();
            sessions.delete(id);
        })
        .connect({
            host,
            port,
            username,
            password,
            keepaliveInterval: 30000,
            keepaliveCountMax: 10,
            readyTimeout: 20000,
        });
});

app.listen(PORT, () => {
    log(`Web terminal server running at http://localhost:${PORT}`);
});
