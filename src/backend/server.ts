import express, { Request, Response } from 'express';
import expressWs from 'express-ws';
import cookieParser from 'cookie-parser';
import { Client } from 'ssh2';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import WebSocket from 'ws';

interface SessionData {
    id: string;
    conn: Client;
    stream: any;
    buffer: string[];
    cols: number;
    rows: number;
    host: string;
    port: number;
    username: string;
    onData?: (data: Buffer) => void;
    ws?: WebSocket & { sentIndex?: number };
    sshListenersAdded?: boolean;
}

interface CommandLogEntry {
    command: string;
    output: string;
    timestamp: string;
    executionTime: number;
    sessionId: string;
}

const APP_PASSWORD = process.env.APP_PASSWORD;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const baseApp = express();
const wsInstance = expressWs(baseApp);
const app = wsInstance.app;
const PORT = process.env.PORT || 3000;

app.use(cookieParser());
app.use(express.json());

// Serve static files except index.html
app.use(
    express.static(path.join(__dirname, '..', 'dist'), {
        index: false,
    })
);

// Custom route for index.html with injected data
app.get('/', (req: Request, res: Response) => {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

    try {
        let html = fs.readFileSync(indexPath, 'utf8');

        // Inject the OPENAI_API_KEY into the HTML
        const scriptInjection = `
        <script>
            window.APP_CONFIG = {
                OPENAI_API_KEY: ${JSON.stringify(OPENAI_API_KEY || '')}
            };
        </script>`;

        // Insert before the closing </head> tag
        html = html.replace('</head>', `${scriptInjection}\n    </head>`);

        res.send(html);
    } catch (error) {
        log('Error serving index.html:', error);
        res.status(500).send('Error loading page');
    }
});

const sessions = new Map<string, SessionData>();

function log(...args: any[]): void {
    console.log(new Date().toISOString(), ...args);
}

app.post('/auth/login', (req: any, res: any) => {
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

app.post('/auth/logout', (req: any, res: any) => {
    res.clearCookie('auth');
    res.json({ ok: true });
});

app.get('/auth/check', (req: any, res: any) => {
    res.json({ authenticated: req.cookies.auth === '1' });
});

app.post('/sessions/terminate', (req: any, res: any) => {
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
app.post('/api/command-log', (req: any, res: any) => {
    if (req.cookies.auth !== '1') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { command, output, timestamp, executionTime, sessionId } =
            req.body;

        if (!command) {
            return res.status(400).json({ error: 'Command is required' });
        }

        const logEntry: CommandLogEntry = {
            command,
            output: output || '',
            timestamp: timestamp || new Date().toISOString(),
            executionTime: executionTime || 0,
            sessionId: sessionId || 'unknown',
        };

        const logFile = path.join(__dirname, 'command-logs.json');

        // Read existing logs
        let logs: CommandLogEntry[] = [];
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

function attachToSession(
    ws: WebSocket & { sentIndex?: number; isAlive?: boolean },
    session: SessionData,
    offset = 0
): void {
    ws.sentIndex = Math.max(0, offset);
    const sendBuffered = () => {
        while (ws.sentIndex! < session.buffer.length) {
            ws.send(session.buffer[ws.sentIndex!]);
            ws.sentIndex!++;
        }
    };

    if (!session.onData) {
        session.onData = (data: Buffer) => {
            const text = data.toString('utf8');
            session.buffer.push(text);
            if (session.buffer.length > 2000) {
                session.buffer.shift();
                if (session.ws && session.ws.sentIndex! > 0) {
                    session.ws.sentIndex!--;
                }
            }
            if (session.ws && session.ws.readyState === 1) {
                session.ws.send(text);
                session.ws.sentIndex = session.buffer.length;
            }
        };
        session.stream.on('data', session.onData);
        session.stream.stderr.on('data', session.onData);
    }

    session.ws = ws;
    log(
        `WebSocket attached to session ${session.id} from ${(ws as any)._socket.remoteAddress}:${(ws as any)._socket.remotePort}`
    );

    let closed = false;
    function handleSshClose(reason: string): void {
        if (closed) return;
        closed = true;
        log(
            `SSH session ${session.id} closed (${reason}) for ${session.username}@${session.host}:${session.port}`
        );
        sessions.delete(session.id);
        if (session.ws && session.ws.readyState === 1) {
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
        session.stream.on('exit', (code: number) =>
            handleSshClose(`stream exit ${code}`)
        );
        session.stream.on('end', () => handleSshClose('stream end'));
        session.stream.on('error', (err: Error) =>
            log(`SSH stream error for session ${session.id}:`, err)
        );
        session.conn.on('close', () => handleSshClose('conn close'));
        session.conn.on('end', () => handleSshClose('conn end'));
        session.conn.on('error', (err: Error) =>
            log(`SSH connection error for session ${session.id}:`, err)
        );
        session.sshListenersAdded = true;
    }

    ws.on('message', (msg: string) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'resize') {
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

    ws.on('close', (code: number, reason: Buffer) => {
        log(
            `WebSocket for session ${session.id} closed code=${code} reason=${reason.toString()}`
        );
        session.ws = undefined;
    });

    ws.on('error', (err: Error) => {
        log(
            `WebSocket error for session ${session.id} from ${(ws as any)._socket.remoteAddress}:${(ws as any)._socket.remotePort}:`,
            err
        );
        session.ws = undefined;
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

app.ws('/terminal', (ws: WebSocket, req: any) => {
    const { sessionId } = req.query;
    const offset = parseInt(req.query.since as string, 10) || 0;
    if (sessionId) {
        if (sessions.has(sessionId as string)) {
            const session = sessions.get(sessionId as string)!;
            log(
                `WebSocket reconnect from ${req.socket.remoteAddress}:${req.socket.remotePort} for session ${sessionId}`
            );
            attachToSession(ws as any, session, offset);
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

    const host = (req.query.host as string) || process.env.SSH_HOST;
    const username = (req.query.user as string) || process.env.SSH_USER;
    const password = (req.query.pass as string) || process.env.SSH_PASS;
    const port = parseInt(req.query.port as string, 10) || 22;

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
    const session: SessionData = {
        id,
        conn,
        stream: null,
        buffer: [],
        cols: 80,
        rows: 24,
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
            (err: Error | undefined, stream: any) => {
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
                attachToSession(ws as any, session);
            }
        );
    })
        .on('error', (err: Error) => {
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
