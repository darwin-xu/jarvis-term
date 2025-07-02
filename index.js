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
        ws.send('Missing SSH credentials');
        ws.close();
        return;
    }

    const conn = new Client();

    conn.on('ready', () => {
        conn.shell(
            { term: 'xterm-256color', cols: 80, rows: 24 },
            (err, stream) => {
                if (err) {
                    ws.send('Shell error: ' + err.message);
                    ws.close();
                    return;
                }

                ws.on('message', msg => stream.write(msg));
                stream.on('data', data => ws.send(data.toString('utf8')));
                stream.stderr.on('data', data =>
                    ws.send(data.toString('utf8'))
                );

                stream.on('close', () => {
                    conn.end();
                    ws.close();
                });
            }
        );
    })
        .on('error', err => {
            ws.send('Connection error: ' + err.message);
            ws.close();
        })
        .connect({ host, username, password });

    ws.on('close', () => conn.end());
});

app.listen(PORT, () => {
    console.log(`Web terminal server running at http://localhost:${PORT}`);
});
