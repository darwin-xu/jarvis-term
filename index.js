const express = require('express');
const expressWs = require('express-ws');
const { Client } = require('ssh2');
const path = require('path');

const app = express();
expressWs(app);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.ws('/terminal', (ws, req) => {
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
        ws.close();
        return;
    }
    const conn = new Client();
    let stream = null;
    let terminalCols = 80;
    let terminalRows = 24;
    let shellReady = false;

    // Set up message handler first
    ws.on('message', msg => {
        try {
            const data = JSON.parse(msg);

            if (data.type === 'resize') {
                // Handle terminal resize
                const newCols = data.cols || 80;
                const newRows = data.rows || 24;

                console.log(`Terminal resize received: ${newCols}x${newRows}`);

                terminalCols = newCols;
                terminalRows = newRows;

                if (stream && stream.setWindow) {
                    // Resize existing shell
                    stream.setWindow(terminalRows, terminalCols);
                    console.log(
                        `Shell resized to: ${terminalCols}x${terminalRows}`
                    );
                }
            } else if (data.type === 'data') {
                // Handle terminal input data
                if (stream && shellReady) {
                    stream.write(data.data);
                }
            }
        } catch (e) {
            // If not JSON, treat as raw terminal data (backward compatibility)
            if (stream && shellReady) {
                stream.write(msg);
            }
        }
    });

    conn.on('ready', () => {
        console.log('SSH connection ready');

        conn.shell(
            {
                term: 'xterm-256color',
                cols: terminalCols,
                rows: terminalRows,
            },
            (err, shellStream) => {
                if (err) {
                    ws.send(
                        JSON.stringify({
                            type: 'error',
                            message: 'Shell error: ' + err.message,
                        })
                    );
                    ws.close();
                    return;
                }

                stream = shellStream;
                shellReady = true;

                console.log(
                    `Shell created with initial size: ${terminalCols}x${terminalRows}`
                );

                // Send ready signal to client after shell is created
                ws.send(
                    JSON.stringify({
                        type: 'ready',
                        message: 'Terminal ready',
                    })
                );

                stream.on('data', data => {
                    ws.send(data.toString('utf8'));
                });

                stream.stderr.on('data', data => {
                    ws.send(data.toString('utf8'));
                });

                stream.on('close', () => {
                    shellReady = false;
                    conn.end();
                    ws.close();
                });
            }
        );
    })
        .on('error', err => {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    message: 'Connection error: ' + err.message,
                })
            );
            ws.close();
        })
        .connect({
            host,
            username,
            password,
            keepaliveInterval: 30000, // Keep connection alive
            readyTimeout: 20000, // Connection timeout
        });

    ws.on('close', () => {
        if (stream) {
            stream.end();
        }
        conn.end();
    });

    ws.on('error', err => {
        console.error('WebSocket error:', err);
        if (stream) {
            stream.end();
        }
        conn.end();
    });
});

app.listen(PORT, () => {
    console.log(`Web terminal server running at http://localhost:${PORT}`);
});
