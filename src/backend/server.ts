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

interface JarvisPlan {
    explanation: string;
    steps: JarvisStep[];
}

interface JarvisStep {
    cmd: string;
    output: string;
    exit: number;
    executed: boolean;
    expectedDuration: number;
    dependsOnPreviousOutput: boolean;
}

interface JarvisSummary {
    achieve: boolean;
    summary: string;
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

// Custom route for index.html
app.get('/', (req: Request, res: Response) => {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

    try {
        let html = fs.readFileSync(indexPath, 'utf8');
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

// AI-related schemas and functions
const planSchema = {
    type: 'json_schema',
    name: 'AgentPlan',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            explanation: {
                type: 'string',
                description:
                    'A human-readable explanation of the plan or next steps.',
            },
            steps: {
                type: 'array',
                description: 'Ordered list of commands to be executed.',
                items: {
                    type: 'object',
                    properties: {
                        cmd: {
                            type: 'string',
                            description: 'The shell command to execute.',
                        },
                        output: {
                            type: 'string',
                            description:
                                'Captured standard output or error from execution. Can be empty before execution.',
                        },
                        exit: {
                            type: 'integer',
                            description:
                                'Exit code from command execution (0 means success).',
                        },
                        executed: {
                            type: 'boolean',
                            description: 'Whether this step has been executed.',
                        },
                        expectedDuration: {
                            type: 'integer',
                            description:
                                'Expected duration in milliseconds for this command to execute.',
                        },
                        dependsOnPreviousOutput: {
                            type: 'boolean',
                            description:
                                'Whether this command has arguments that depend on the output of previous commands.',
                        },
                    },
                    required: [
                        'cmd',
                        'output',
                        'exit',
                        'executed',
                        'expectedDuration',
                        'dependsOnPreviousOutput',
                    ],
                    additionalProperties: false,
                },
            },
        },
        required: ['explanation', 'steps'],
        additionalProperties: false,
    },
};

const summarySchema = {
    type: 'json_schema',
    name: 'AgentPlanSummary',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            achieve: {
                type: 'boolean',
                description: 'Whether the goal has been achieved.',
            },
            summary: {
                type: 'string',
                description:
                    'Human-readable summary of the overall execution outcome.',
            },
        },
        required: ['achieve', 'summary'],
        additionalProperties: false,
    },
};

const planInstruction = `You are an AI agent designed to help users by providing the correct command lines to execute in a Linux terminal.
An autobot will execute the Linux commands and collect the output.
You will be given a goal from the user.
You will be provided with a history of the plan and the executed results.
You need to generate the following plan based on that information.
Briefly describe what you are going to do in the "explanation" field in the JSON section.
List all precise shell commands in the "steps" field in the JSON section.
If a command's arguments depend on the output of previous commands, mark it as "dependsOnPreviousOutput" and provide placeholders for the command's arguments.`;

const summaryInstruction = `You are an AI agent designed to help users by providing the correct command lines to execute in a Linux terminal.
Now the plan has been executed with result.
Please determine if the goal has been achieved based on the provided plan and execution results.
Please generate a summary if the goal has been achieved.`;

async function getPlan(
    goal: string,
    plan: JarvisPlan | null = null
): Promise<string> {
    let prompt = [
        { role: 'system', content: planInstruction },
        {
            role: 'user',
            content: plan
                ? `The goal is: ${goal}. The result of the executed plan is: ${JSON.stringify(plan)}. ` +
                  `If the goal is not achieved, please provide a new plan to achieve this goal.`
                : `The goal is: ${goal}. Please provide a plan to achieve this goal.`,
        },
    ];

    try {
        const response = await fetch(`http://35.234.22.51:8080/v1/responses`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4.1-nano',
                input: prompt,
                text: {
                    format: planSchema,
                },
            }),
        });

        if (!response.ok) {
            return `Error: Failed to get response from OpenAI (${response.status})`;
        }

        const data = (await response.json()) as any;
        return data.output?.[0].content?.[0]?.text;
    } catch (err) {
        return `Error: ${err}`;
    }
}

async function getSummary(result: string): Promise<string> {
    let prompt = [
        { role: 'system', content: summaryInstruction },
        { role: 'user', content: `The execution result is: ${result}` },
    ];

    const response = await fetch(`http://35.234.22.51:8080/v1/responses`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4.1-nano',
            input: prompt,
            text: {
                format: summarySchema,
            },
        }),
    });

    if (!response.ok) {
        throw new Error(
            `Failed to get response from OpenAI (${response.status})`
        );
    }

    const data = (await response.json()) as any;
    return data.output?.[0].content?.[0]?.text;
}

async function executeCommandOnSession(
    sessionId: string,
    command: string
): Promise<{ output: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
        const session = sessions.get(sessionId);
        if (!session || !session.stream) {
            reject(new Error('Session not found or not connected'));
            return;
        }

        let outputBuffer = '';
        let commandStartTime = Date.now();
        let isExecuting = true;

        // Create a temporary data handler for this command
        const originalOnData = session.onData;
        let commandTimeout: NodeJS.Timeout;

        const finishExecution = (
            exitCode: number = 0,
            isTimeout: boolean = false
        ) => {
            if (!isExecuting) return;
            isExecuting = false;

            // Clear timeout
            if (commandTimeout) {
                clearTimeout(commandTimeout);
            }

            // Restore original data handler
            if (originalOnData) {
                session.onData = originalOnData;
                session.stream.removeAllListeners('data');
                session.stream.on('data', originalOnData);
            }

            // Clean output by removing ANSI escape codes
            let cleanOutput = outputBuffer
                .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI escape codes
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .trim();

            resolve({ output: cleanOutput, exitCode });
        };

        // Set up command timeout (60 seconds)
        commandTimeout = setTimeout(() => {
            finishExecution(-1, true);
        }, 60000);

        // Set up data handler to capture output
        const commandDataHandler = (data: Buffer) => {
            const text = data.toString('utf8');
            outputBuffer += text;

            // Also send to original handler so WebSocket clients still see output
            if (originalOnData) {
                originalOnData(data);
            }

            // Check for command prompt patterns to detect completion
            const promptPatterns = [
                /\$ $/m,
                /# $/m,
                /> $/m,
                /\] $/m,
                /% $/m,
                /➜ /m,
                /❯ /m,
                /\$\s*$/m,
                /#\s*$/m,
                /bash-[\d\.]+-\$ $/m,
                /zsh-[\d\.]+-% $/m,
            ];

            const hasPrompt = promptPatterns.some(pattern =>
                pattern.test(text)
            );
            if (hasPrompt) {
                setTimeout(() => {
                    if (isExecuting) {
                        // Get exit code by sending 'echo $?' command
                        const exitCodeCommand = 'echo $?\n';
                        let exitCodeBuffer = '';
                        let gotExitCode = false;

                        const exitCodeHandler = (exitData: Buffer) => {
                            if (gotExitCode) return;
                            const exitText = exitData.toString('utf8');
                            exitCodeBuffer += exitText;

                            // Look for the exit code in the output
                            const lines = exitCodeBuffer.split('\n');
                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (/^\d+$/.test(trimmed)) {
                                    gotExitCode = true;
                                    session.stream.removeListener(
                                        'data',
                                        exitCodeHandler
                                    );
                                    finishExecution(parseInt(trimmed, 10));
                                    return;
                                }
                            }
                        };

                        session.stream.on('data', exitCodeHandler);
                        session.stream.write(exitCodeCommand);

                        // Fallback timeout for exit code check
                        setTimeout(() => {
                            if (!gotExitCode) {
                                session.stream.removeListener(
                                    'data',
                                    exitCodeHandler
                                );
                                finishExecution(0); // Assume success if we can't get exit code
                            }
                        }, 2000);
                    }
                }, 100);
            }
        };

        // Replace the data handler temporarily
        session.onData = commandDataHandler;
        session.stream.removeAllListeners('data');
        session.stream.on('data', commandDataHandler);

        // Send the command
        const commandToSend = command.trim() + '\n';
        session.stream.write(commandToSend);
    });
}

// Main Jarvis execution endpoint
app.post('/api/jarvis-execute', async (req: any, res: any) => {
    if (req.cookies.auth !== '1') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const { goal, sessionId } = req.body;

        if (!goal) {
            return res.status(400).json({ error: 'Goal is required' });
        }

        if (!sessionId) {
            return res.status(400).json({ error: 'Session ID is required' });
        }

        const session = sessions.get(sessionId);
        if (!session) {
            return res.status(400).json({ error: 'Invalid session ID' });
        }

        log(`Jarvis execute request: ${goal} for session ${sessionId}`);

        // Set up SSE for real-time updates
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        const sendEvent = (type: string, data: any) => {
            res.write(`event: ${type}\n`);
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        try {
            let plan: JarvisPlan = JSON.parse(await getPlan(goal));
            let retry = 30;

            do {
                if (
                    !plan ||
                    typeof plan !== 'object' ||
                    !plan.explanation ||
                    !plan.steps ||
                    !Array.isArray(plan.steps)
                ) {
                    sendEvent('error', {
                        message: 'Invalid AI response format',
                    });
                    res.end();
                    return;
                }

                sendEvent('plan', { explanation: plan.explanation });

                let success = true;
                for (const step of plan.steps) {
                    if (step.executed) continue;
                    if (step.dependsOnPreviousOutput) {
                        sendEvent('message', {
                            content: `🔄 Command depends on previous command's output: ${step.cmd}.`,
                            type: 'ai-plan',
                        });
                        continue;
                    }

                    try {
                        sendEvent('command', { command: step.cmd });
                        const result = await executeCommandOnSession(
                            sessionId,
                            step.cmd
                        );
                        step.output = result.output;
                        step.exit = result.exitCode;
                        step.executed = true;

                        if (step.exit !== 0) {
                            success = false;
                            break;
                        }

                        sendEvent('command_result', {
                            command: step.cmd,
                            output: result.output,
                            exitCode: result.exitCode,
                        });
                    } catch (error) {
                        sendEvent('error', {
                            message: `Command failed: ${error}`,
                        });
                        res.end();
                        return;
                    }
                }

                const summaryResult: JarvisSummary = JSON.parse(
                    await getSummary(JSON.stringify(plan))
                );

                if (summaryResult.achieve) {
                    sendEvent('success', {
                        message: `✅ Goal achieved! Summary: ${summaryResult.summary}`,
                    });
                    res.end();
                    return;
                } else {
                    // Remove unexecuted steps and get new plan
                    plan.steps = plan.steps.filter(step => step.executed);
                    const newPlan: JarvisPlan = JSON.parse(
                        await getPlan(goal, plan)
                    );
                    plan = { ...plan, ...newPlan };
                }
            } while (retry-- > 0);

            sendEvent('error', { message: 'Maximum retry attempts reached' });
        } catch (error) {
            sendEvent('error', { message: `Error: ${error}` });
        }

        res.end();
    } catch (error) {
        log('Error in jarvis-execute:', error);
        res.status(500).json({ error: 'Internal server error' });
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
