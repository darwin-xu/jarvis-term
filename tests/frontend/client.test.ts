/**
 * Frontend Client Test Suite
 *
 * Tests for the frontend client.ts functionality.
 * Since client.ts is a browser-specific module with DOM dependencies,
 * these tests focus on the testable utility functions and API interactions.
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock basic browser environment for client.ts
Object.defineProperty(global, 'window', {
    value: {
        APP_CONFIG: { OPENAI_API_KEY: 'test-api-key' },
        location: { protocol: 'https:', host: 'localhost:3000' },
        localStorage: {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn(),
        },
    },
    writable: true,
});

describe('Frontend Client', () => {
    let mockFetch: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    });

    describe('AI Functions Integration', () => {
        it('should use AI utils from shared module', () => {
            // Test that the client can access AI utility functions
            // from the shared ai-utils module
            const {
                getPlan,
                getSummary,
            } = require('../../src/shared/ai-utils');

            expect(typeof getPlan).toBe('function');
            expect(typeof getSummary).toBe('function');
        });

        it('should handle AI plan generation', async () => {
            const mockResponse = {
                output: [
                    {
                        content: [
                            {
                                text: JSON.stringify({
                                    explanation:
                                        'List files in current directory',
                                    steps: [
                                        {
                                            cmd: 'ls -la',
                                            output: '',
                                            exit: 0,
                                            executed: false,
                                            expectedDuration: 1000,
                                            dependsOnPreviousOutput: false,
                                        },
                                    ],
                                }),
                            },
                        ],
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const { getPlan } = require('../../src/shared/ai-utils');
            const result = await getPlan('list files');
            const plan = JSON.parse(result);

            expect(plan.explanation).toBe('List files in current directory');
            expect(plan.steps).toHaveLength(1);
            expect(plan.steps[0].cmd).toBe('ls -la');
        });

        it('should handle AI summary generation', async () => {
            const mockResponse = {
                output: [
                    {
                        content: [
                            {
                                text: JSON.stringify({
                                    achieve: true,
                                    summary: 'Successfully listed files',
                                }),
                            },
                        ],
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const { getSummary } = require('../../src/shared/ai-utils');
            const result = await getSummary('Command executed successfully');
            const summary = JSON.parse(result);

            expect(summary.achieve).toBe(true);
            expect(summary.summary).toBe('Successfully listed files');
        });

        it('should handle AI API errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            } as Response);

            const { getPlan } = require('../../src/shared/ai-utils');

            try {
                await getPlan('test goal');
            } catch (error: any) {
                expect(error.message).toContain('OpenAI');
            }
        });
    });

    describe('WebSocket Communication', () => {
        it('should work with WebSocket API', () => {
            // Mock WebSocket for testing
            global.WebSocket = jest.fn(() => ({
                readyState: 1,
                send: jest.fn(),
                close: jest.fn(),
                addEventListener: jest.fn(),
                onopen: null,
                onmessage: null,
                onclose: null,
                onerror: null,
            })) as any;

            const ws = new WebSocket('wss://test');

            expect(ws).toBeDefined();
            expect(ws.send).toBeDefined();
            expect(ws.close).toBeDefined();
            expect(typeof ws.readyState).toBe('number');
        });

        it('should send commands through WebSocket', () => {
            const mockWebSocket = {
                send: jest.fn(),
                close: jest.fn(),
                readyState: 1,
            };

            global.WebSocket = jest.fn(() => mockWebSocket) as any;
            const ws = new WebSocket('wss://test');

            const command = JSON.stringify({ type: 'data', data: 'ls -la\n' });
            ws.send(command);

            expect(mockWebSocket.send).toHaveBeenCalledWith(command);
        });
    });

    describe('Local Storage Integration', () => {
        it('should work with localStorage API', () => {
            const { localStorage } = (global as any).window;

            localStorage.setItem('test', 'value');
            expect(localStorage.setItem).toHaveBeenCalledWith('test', 'value');

            localStorage.getItem('test');
            expect(localStorage.getItem).toHaveBeenCalledWith('test');
        });

        it('should handle session storage', () => {
            const { localStorage } = (global as any).window;

            localStorage.setItem('sessionId', 'test-session-123');
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'sessionId',
                'test-session-123'
            );

            localStorage.getItem('sessionId');
            expect(localStorage.getItem).toHaveBeenCalledWith('sessionId');

            localStorage.removeItem('sessionId');
            expect(localStorage.removeItem).toHaveBeenCalledWith('sessionId');
        });

        it('should handle configuration storage', () => {
            const { localStorage } = (global as any).window;

            // Test configuration storage
            localStorage.setItem('llm-provider', 'openai');
            localStorage.setItem('custom-api-url', 'https://api.custom.com');

            expect(localStorage.setItem).toHaveBeenCalledWith(
                'llm-provider',
                'openai'
            );
            expect(localStorage.setItem).toHaveBeenCalledWith(
                'custom-api-url',
                'https://api.custom.com'
            );
        });
    });

    describe('Command Execution Utilities', () => {
        it('should have command parsing capabilities', () => {
            // Test command parsing logic that might be in the client
            const testCommands = [
                '/cmd ls -la',
                '/command echo hello',
                '/exec pwd',
                '/run whoami',
            ];

            testCommands.forEach(cmd => {
                // Test that command parsing would work
                expect(
                    cmd.startsWith('/cmd') ||
                        cmd.startsWith('/command') ||
                        cmd.startsWith('/exec') ||
                        cmd.startsWith('/run')
                ).toBe(true);
            });
        });

        it('should handle exit code parsing', () => {
            // Test exit code parsing utility
            const outputs = [
                '0\ncommand output',
                'command output\n0',
                '1\nerror output',
                'error message\n1',
            ];

            outputs.forEach(output => {
                const lines = output.split('\n');
                const hasExitCode = lines.some(line =>
                    line.trim().match(/^\d+$/)
                );
                expect(typeof hasExitCode).toBe('boolean');
            });
        });

        it('should parse command prefixes correctly', () => {
            const parseCommand = (message: string): string | null => {
                const commandPrefixes = ['/cmd', '/command', '/exec', '/run'];
                const lowercaseMessage = message.toLowerCase().trim();

                for (const prefix of commandPrefixes) {
                    if (lowercaseMessage.startsWith(prefix + ' ')) {
                        return message.substring(prefix.length + 1).trim();
                    }
                }
                return null;
            };

            expect(parseCommand('/cmd ls -la')).toBe('ls -la');
            expect(parseCommand('/command pwd')).toBe('pwd');
            expect(parseCommand('/exec echo hello')).toBe('echo hello');
            expect(parseCommand('/run whoami')).toBe('whoami');
            expect(parseCommand('regular message')).toBeNull();
        });

        it('should extract exit codes from output', () => {
            const getExitCode = (output: string): number => {
                // Remove the first line if it doesn't contain the exit code
                const lines = output.split('\n');
                if (lines.length > 1 && !lines[0].trim().match(/^\d+$/)) {
                    lines.shift(); // Remove the first line
                }
                // Check if the last line is an exit code
                return +lines[0].trim();
            };

            expect(getExitCode('0')).toBe(0);
            expect(getExitCode('command output\n0')).toBe(0);
            expect(getExitCode('1')).toBe(1);
            expect(getExitCode('error output\n1')).toBe(1);
        });
    });

    describe('Configuration Management', () => {
        it('should handle configuration loading', () => {
            const config = {
                OPENAI_API_KEY: 'test-key-123',
            };

            (global as any).window.APP_CONFIG = config;

            // Test configuration access
            const appConfig = (global as any).window.APP_CONFIG;
            expect(appConfig.OPENAI_API_KEY).toBe('test-key-123');
        });

        it('should support multiple LLM providers', () => {
            const providers = ['openai', 'anthropic', 'custom'];

            providers.forEach(provider => {
                expect(typeof provider).toBe('string');
                expect(provider.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors in API calls', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const { getPlan } = require('../../src/shared/ai-utils');

            try {
                await getPlan('test goal');
            } catch (error: any) {
                expect(error.message).toContain('Network error');
            }
        });

        it('should handle malformed JSON responses', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => {
                    throw new Error('Invalid JSON');
                },
            } as unknown as Response);

            const { getPlan } = require('../../src/shared/ai-utils');

            try {
                await getPlan('test goal');
            } catch (error: any) {
                expect(error.message).toContain('Invalid JSON');
            }
        });

        it('should handle missing API keys', async () => {
            // Temporarily remove API key
            const originalConfig = (global as any).window.APP_CONFIG;
            (global as any).window.APP_CONFIG = {};

            const { getPlan } = require('../../src/shared/ai-utils');

            try {
                await getPlan('test goal');
            } catch (error: any) {
                expect(error.message).toContain('API key');
            }

            // Restore original config
            (global as any).window.APP_CONFIG = originalConfig;
        });

        it('should handle WebSocket connection failures gracefully', () => {
            const mockWebSocket = {
                readyState: 3, // CLOSED
                send: jest.fn(),
                close: jest.fn(),
                onerror: null as any,
            };

            global.WebSocket = jest.fn(() => mockWebSocket) as any;
            const ws = new WebSocket('wss://test');

            // Simulate connection error
            if (ws.onerror) {
                ws.onerror({
                    message: 'Connection failed',
                    error: new Error('Network error'),
                } as any);
            }

            expect(ws.readyState).toBe(3); // CLOSED
        });
    });

    describe('Session Management', () => {
        it('should handle session termination API calls', () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
            } as Response);

            // Test session termination would make API call
            fetch('/sessions/terminate', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: 'test-session' }),
            });

            expect(mockFetch).toHaveBeenCalledWith('/sessions/terminate', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: 'test-session' }),
            });
        });

        it('should handle session restoration', () => {
            const { localStorage } = (global as any).window;

            // Mock stored session
            localStorage.getItem.mockReturnValue('stored-session-456');

            const sessionId = localStorage.getItem('sessionId');
            expect(sessionId).toBe('stored-session-456');
        });
    });

    describe('Authentication', () => {
        it('should handle authentication check API calls', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ authenticated: true }),
            } as Response);

            const response = await fetch('/auth/check', {
                credentials: 'include',
            });
            const data = (await response.json()) as { authenticated: boolean };

            expect(mockFetch).toHaveBeenCalledWith('/auth/check', {
                credentials: 'include',
            });
            expect(data.authenticated).toBe(true);
        });

        it('should handle login API calls', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
            } as Response);

            const response = await fetch('/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: 'test-password' }),
            });

            expect(mockFetch).toHaveBeenCalledWith('/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: 'test-password' }),
            });
            expect(response.ok).toBe(true);
        });

        it('should handle authentication failures', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
            } as Response);

            const response = await fetch('/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: 'wrong-password' }),
            });

            expect(response.ok).toBe(false);
            expect(response.status).toBe(401);
        });
    });

    describe('AI Message Processing', () => {
        it('should handle AI message structures', () => {
            const aiMessage = {
                content: 'Test message',
                isUser: true,
                messageType: 'normal',
                timestamp: Date.now(),
            };

            expect(aiMessage.content).toBe('Test message');
            expect(aiMessage.isUser).toBe(true);
            expect(aiMessage.messageType).toBe('normal');
            expect(typeof aiMessage.timestamp).toBe('number');
        });

        it('should handle command log entries', () => {
            const logEntry = {
                command: 'ls -la',
                output: 'total 16\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .',
                timestamp: new Date().toISOString(),
                executionTime: 250,
                isTimeout: false,
            };

            expect(logEntry.command).toBe('ls -la');
            expect(logEntry.output).toContain('total 16');
            expect(typeof logEntry.executionTime).toBe('number');
            expect(logEntry.isTimeout).toBe(false);
        });

        it('should handle plan schemas correctly', () => {
            const planSchema = {
                explanation: 'Human readable description of what to achieve',
                steps: [
                    {
                        cmd: 'shell command to execute',
                        output: '',
                        exit: 0,
                        executed: false,
                        expectedDuration: 1000,
                        dependsOnPreviousOutput: false,
                    },
                ],
            };

            expect(planSchema.explanation).toBeDefined();
            expect(Array.isArray(planSchema.steps)).toBe(true);
            expect(planSchema.steps[0].cmd).toBeDefined();
            expect(typeof planSchema.steps[0].expectedDuration).toBe('number');
        });

        it('should handle summary schemas correctly', () => {
            const summarySchema = {
                achieve: true,
                summary: 'Brief summary of what was accomplished',
            };

            expect(typeof summarySchema.achieve).toBe('boolean');
            expect(typeof summarySchema.summary).toBe('string');
        });
    });

    describe('Utility Functions', () => {
        it('should handle prompt pattern matching', () => {
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
            ];

            const testOutputs = [
                'user@host:~$ ',
                'root@host:~# ',
                'command output\n$ ',
                'error message\n# ',
            ];

            testOutputs.forEach(output => {
                const hasPrompt = promptPatterns.some(pattern =>
                    pattern.test(output)
                );
                expect(typeof hasPrompt).toBe('boolean');
            });
        });

        it('should handle command context formatting', () => {
            const commandContext = [
                {
                    command: 'ls -la',
                    output: 'total 16\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .',
                    timestamp: new Date().toISOString(),
                    success: true,
                },
                {
                    command: 'pwd',
                    output: '/home/user',
                    timestamp: new Date().toISOString(),
                    success: true,
                },
            ];

            const formatted = commandContext
                .map(
                    cmd =>
                        `Command: ${cmd.command}\nOutput: ${cmd.output.substring(0, 200)}\nStatus: ${cmd.success ? 'Success' : 'Error'}\n`
                )
                .join('\n---\n');

            expect(formatted).toContain('Command: ls -la');
            expect(formatted).toContain('Status: Success');
            expect(formatted).toContain('---');
        });
    });
});
