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

function cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastActive > SESSION_TIMEOUT_MS) {
            if (session.stream) {
                session.stream.end();
            }
            session.conn.end();
            sessions.delete(id);
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

const PING_INTERVAL = 15000;
const log = (...args) => console.log(new Date().toISOString(), ...args);

function attachToSession(ws, session) {
    log(`Attaching WebSocket to session ${session.id}`);
    const sendBuffered = () => {
        while (session.sentIndex < session.buffer.length) {
            ws.send(session.buffer[session.sentIndex]);
            session.sentIndex++;
        }
    };

    const onData = data => {
        const text = data.toString('utf8');
        session.buffer.push(text);
        if (session.buffer.length > 2000) {
            session.buffer.shift();
            if (session.sentIndex > 0) {
                session.sentIndex--;
            }
        }
        session.lastActive = Date.now();
        if (ws.readyState === ws.OPEN) {
            ws.send(text);
            session.sentIndex = session.buffer.length;
        }
    };

    session.stream.on('data', onData);
    session.stream.stderr.on('data', onData);

    let closed = false;
    function handleSshClose() {
        if (closed) return;
        closed = true;
        log(`SSH session ${session.id} closed`);
        clearInterval(pingInterval);
        session.lastActive = Date.now();
        sessions.delete(session.id);
        if (ws.readyState === ws.OPEN) {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    message: 'SSH session closed',
                })
            );
            ws.close();
        }
    }

    session.stream.on('close', handleSshClose);
    session.stream.on('exit', handleSshClose);
    session.stream.on('end', handleSshClose);
    session.conn.on('close', handleSshClose);
    session.conn.on('end', handleSshClose);

    ws.isAlive = true;

    const pingInterval = setInterval(() => {
        if (ws.readyState !== ws.OPEN) {
            clearInterval(pingInterval);
            return;
        }
        if (!ws.isAlive) {
            clearInterval(pingInterval);
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        try {
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
            } else if (data.type === 'ping') {
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
        log(`WebSocket for session ${session.id} closed`, code, reason);
        session.stream.removeListener('data', onData);
        session.stream.stderr.removeListener('data', onData);
        session.stream.removeListener('close', handleSshClose);
        session.stream.removeListener('exit', handleSshClose);
        session.stream.removeListener('end', handleSshClose);
        session.conn.removeListener('close', handleSshClose);
        session.conn.removeListener('end', handleSshClose);
        session.lastActive = Date.now();
        clearInterval(pingInterval);
    });

    ws.on('error', err => {
        log(`WebSocket error for session ${session.id}`, err.message);
        session.stream.removeListener('data', onData);
        session.stream.stderr.removeListener('data', onData);
        session.stream.removeListener('close', handleSshClose);
        session.stream.removeListener('exit', handleSshClose);
        session.stream.removeListener('end', handleSshClose);
        session.conn.removeListener('close', handleSshClose);
        session.conn.removeListener('end', handleSshClose);
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
    if (sessionId) {
        if (sessions.has(sessionId)) {
            const session = sessions.get(sessionId);
            attachToSession(ws, session);
            return;
        } else {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    message: 'Invalid session ID',
                })
            );
            log('Closing WebSocket due to invalid session');
            ws.close();
            return;
        }
    }

    if (req.cookies.auth !== '1') {
        ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
        log('Closing WebSocket: unauthorized access');
        ws.close();
        return;
    }

    const host = req.query.host || process.env.SSH_HOST;
    const username = req.query.user || process.env.SSH_USER;
    const password = req.query.pass || process.env.SSH_PASS;

    if (!host || !username || !password) {
        ws.send(
            JSON.stringify({
                type: 'error',
                message: 'Missing SSH credentials',
            })
        );
        log('Closing WebSocket: missing SSH credentials');
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
        sentIndex: 0,
        cols: 80,
        rows: 24,
        lastActive: Date.now(),
    };
    sessions.set(id, session);
    log(`Created SSH session ${id} for ${username}@${host}`);

    conn.on('ready', () => {
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
            log(`SSH connection error for session ${id}: ${err.message}`);
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
            username,
            password,
            keepaliveInterval: 30000,
            keepaliveCountMax: 10,
            readyTimeout: 20000,
        });
});

app.listen(PORT, () => {
    console.log(`Web terminal server running at http://localhost:${PORT}`);
});
