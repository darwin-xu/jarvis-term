const request = require('supertest');
const { createTestApp } = require('./testApp');

describe('Command Logging API', () => {
    let app;
    let authenticatedAgent;

    beforeEach(async () => {
        app = createTestApp();

        // Create an authenticated agent
        authenticatedAgent = request.agent(app);
        await authenticatedAgent
            .post('/auth/login')
            .send({ password: 'test-password' })
            .expect(200);
    });

    describe('POST /api/command-log', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/command-log')
                .send({
                    command: 'ls -la',
                    output: 'file1\nfile2',
                    timestamp: new Date().toISOString(),
                    executionTime: 100,
                    sessionId: 'test-session',
                })
                .expect(401);

            expect(response.body).toEqual({ error: 'Unauthorized' });
        });

        it('should log command successfully with all fields', async () => {
            const commandData = {
                command: 'ls -la',
                output: 'file1\nfile2\nfile3',
                timestamp: new Date().toISOString(),
                executionTime: 150,
                sessionId: 'test-session-123',
            };

            const response = await authenticatedAgent
                .post('/api/command-log')
                .send(commandData)
                .expect(200);

            expect(response.body).toEqual({ ok: true });
        });

        it('should log command with minimal required fields', async () => {
            const commandData = {
                command: 'pwd',
            };

            const response = await authenticatedAgent
                .post('/api/command-log')
                .send(commandData)
                .expect(200);

            expect(response.body).toEqual({ ok: true });
        });

        it('should reject request without command', async () => {
            const commandData = {
                output: 'some output',
                timestamp: new Date().toISOString(),
                executionTime: 100,
                sessionId: 'test-session',
            };

            const response = await authenticatedAgent
                .post('/api/command-log')
                .send(commandData)
                .expect(400);

            expect(response.body).toEqual({ error: 'Command is required' });
        });

        it('should reject request with empty command', async () => {
            const commandData = {
                command: '',
                output: 'some output',
                timestamp: new Date().toISOString(),
                executionTime: 100,
                sessionId: 'test-session',
            };

            const response = await authenticatedAgent
                .post('/api/command-log')
                .send(commandData)
                .expect(400);

            expect(response.body).toEqual({ error: 'Command is required' });
        });

        it('should handle whitespace-only command', async () => {
            const commandData = {
                command: '   ',
                output: 'some output',
                timestamp: new Date().toISOString(),
                executionTime: 100,
                sessionId: 'test-session',
            };

            const response = await authenticatedAgent
                .post('/api/command-log')
                .send(commandData)
                .expect(400);

            expect(response.body).toEqual({ error: 'Command is required' });
        });

        it('should handle special characters in command', async () => {
            const commandData = {
                command: 'grep -r "test.*pattern" . | sort',
                output: './file1:match\n./file2:another match',
                timestamp: new Date().toISOString(),
                executionTime: 200,
                sessionId: 'test-session',
            };

            const response = await authenticatedAgent
                .post('/api/command-log')
                .send(commandData)
                .expect(200);

            expect(response.body).toEqual({ ok: true });
        });

        it('should handle very long command and output', async () => {
            const longCommand = 'echo ' + 'a'.repeat(1000);
            const longOutput = 'b'.repeat(5000);

            const commandData = {
                command: longCommand,
                output: longOutput,
                timestamp: new Date().toISOString(),
                executionTime: 50,
                sessionId: 'test-session',
            };

            const response = await authenticatedAgent
                .post('/api/command-log')
                .send(commandData)
                .expect(200);

            expect(response.body).toEqual({ ok: true });
        });

        it('should handle unicode characters', async () => {
            const commandData = {
                command: 'echo "Hello 世界 🌍"',
                output: 'Hello 世界 🌍',
                timestamp: new Date().toISOString(),
                executionTime: 30,
                sessionId: 'test-session',
            };

            const response = await authenticatedAgent
                .post('/api/command-log')
                .send(commandData)
                .expect(200);

            expect(response.body).toEqual({ ok: true });
        });
    });
});
