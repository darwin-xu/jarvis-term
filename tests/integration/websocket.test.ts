import { MockWebSocket, MockSSHClient, MockSSHStream } from '../mocks';
import WebSocket from 'ws';

// Mock WebSocket and SSH2
jest.mock('ws');
jest.mock('ssh2', () => ({
    Client: MockSSHClient,
}));

describe('WebSocket Integration', () => {
    let mockWs: MockWebSocket;

    beforeEach(() => {
        mockWs = new MockWebSocket('ws://localhost:3000/terminal');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Terminal Connection Flow', () => {
        it('should establish WebSocket connection', done => {
            mockWs.addEventListener('open', () => {
                expect(mockWs.readyState).toBe(MockWebSocket.OPEN);
                done();
            });
        });

        it('should handle authentication', done => {
            const authMessage = JSON.stringify({
                type: 'auth',
                password: 'test-password',
            });

            mockWs.addEventListener('open', () => {
                mockWs.addEventListener('message', (event: any) => {
                    const data = JSON.parse(event.data || event);
                    if (data.type === 'ready') {
                        expect(data.sessionId).toBeDefined();
                        done();
                    }
                });

                mockWs.send(authMessage);
            });
        });

        it('should handle terminal resize', done => {
            const resizeMessage = JSON.stringify({
                type: 'resize',
                cols: 120,
                rows: 40,
            });

            mockWs.addEventListener('open', () => {
                expect(() => mockWs.send(resizeMessage)).not.toThrow();
                done();
            });
        });

        it('should handle command input', done => {
            const authMessage = JSON.stringify({
                type: 'auth',
                password: 'test-password',
            });

            const commandMessage = JSON.stringify({
                type: 'data',
                data: 'echo "test"\n',
            });

            mockWs.addEventListener('open', () => {
                let isAuthenticated = false;

                mockWs.addEventListener('message', (event: any) => {
                    try {
                        const data = JSON.parse(event.data || event);

                        // First handle authentication
                        if (data.type === 'ready' && !isAuthenticated) {
                            isAuthenticated = true;
                            // Send command after authentication
                            mockWs.send(commandMessage);
                        }
                    } catch (e) {
                        // Handle non-JSON messages (command echoes)
                        if (
                            isAuthenticated &&
                            typeof (event.data || event) === 'string'
                        ) {
                            // Command echo back indicates successful processing
                            done();
                        }
                    }
                });

                // Start with authentication
                mockWs.send(authMessage);
            });
        });
    });

    describe('Session Management', () => {
        it('should create new session with unique ID', done => {
            mockWs.addEventListener('open', () => {
                // Send auth first to get ready message
                const authMessage = JSON.stringify({
                    type: 'auth',
                    password: 'test-password',
                });

                mockWs.addEventListener('message', (event: any) => {
                    const data = JSON.parse(event.data || event);
                    if (data.type === 'ready') {
                        expect(data.sessionId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
                        done();
                    }
                });

                mockWs.send(authMessage);
            });
        });

        it('should reconnect to existing session', done => {
            const sessionId = 'test-session-id';
            const reconnectWs = new MockWebSocket(
                `ws://localhost:3000/terminal?sessionId=${sessionId}`
            );

            reconnectWs.addEventListener('open', () => {
                // Send auth to get ready message with sessionId
                const authMessage = JSON.stringify({
                    type: 'auth',
                    password: 'test-password',
                });

                reconnectWs.addEventListener('message', (event: any) => {
                    const data = JSON.parse(event.data || event);
                    if (data.type === 'ready') {
                        expect(data.sessionId).toBe(sessionId);
                        done();
                    }
                });

                reconnectWs.send(authMessage);
            });
        });

        it('should handle session termination', done => {
            mockWs.addEventListener('open', () => {
                mockWs.close();
            });

            mockWs.addEventListener('close', () => {
                expect(mockWs.readyState).toBe(MockWebSocket.CLOSED);
                done();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle WebSocket errors', done => {
            mockWs.addEventListener('error', (error: any) => {
                expect(error).toBeDefined();
                done();
            });

            // Simulate error
            mockWs.emit('error', new Error('Connection error'));
        });

        it('should handle malformed messages', done => {
            mockWs.addEventListener('open', () => {
                // Send malformed JSON
                expect(() => mockWs.send('invalid json {')).not.toThrow();
                done();
            });
        });
    });
});
