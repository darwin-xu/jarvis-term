const { Client } = require('ssh2');

const host = process.argv[2] || process.env.SSH_HOST;
const username = process.argv[3] || process.env.SSH_USER;
const password = process.argv[4] || process.env.SSH_PASS;

if (!host || !username || !password) {
    console.log('Usage: node index.js <host> <username> <password>');
    process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
    console.log('SSH connection established. Opening shell...');
    
    // Get current terminal size
    const { columns, rows } = process.stdout;
    
    conn.shell({
        cols: columns || 80,
        rows: rows || 24,
        term: process.env.TERM || 'xterm-256color'
    }, (err, stream) => {
        if (err) {
            console.error('Shell error:', err);
            conn.end();
            return;
        }
        
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.pipe(stream);
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);
        
        // Handle terminal resize events
        process.stdout.on('resize', () => {
            const { columns, rows } = process.stdout;
            stream.setWindow(rows, columns);
        });
        
        stream.on('close', () => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            conn.end();
        });
    });
})
    .on('error', err => {
        console.error('Connection error:', err);
    })
    .connect({ host, username, password });
