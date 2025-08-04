import { MockWebSocket, MockSSHClient, MockAIService } from '../mocks';
import { getPlan, getSummary } from '../../src/frontend/ai-service';

// Mock all external dependencies
jest.mock('ws');
jest.mock('ssh2', () => ({ Client: MockSSHClient }));
global.fetch = jest.fn();

// Mock window.APP_CONFIG for browser environment
(global as any).window = {
    APP_CONFIG: {
        OPENAI_API_KEY: 'test-api-key',
    },
};

describe('End-to-End Scenarios', () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
        mockFetch.mockClear();
        MockAIService.clearMockResponses();
    });

    describe('Complete Jarvis Workflow', () => {
        it('should execute simple file listing task', async () => {
            // Mock AI response
            const planResponse = {
                content: [
                    {
                        text: JSON.stringify({
                            explanation: 'List files in current directory',
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
            };

            const summaryResponse = {
                content: [
                    {
                        text: JSON.stringify({
                            achieve: true,
                            summary:
                                'Successfully listed files in the directory',
                        }),
                    },
                ],
            };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => planResponse,
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => summaryResponse,
                } as Response);

            // Simulate the workflow
            // 1. Get plan from AI
            const planResult = await getPlan('list files in current directory');
            const plan = JSON.parse(planResult);

            expect(plan.explanation).toBe('List files in current directory');
            expect(plan.steps[0].cmd).toBe('ls -la');

            // 2. Execute command (simulated)
            plan.steps[0].executed = true;
            plan.steps[0].output =
                'total 8\ndrwxr-xr-x 3 user user 4096 Jan 1 12:00 .\ndrwxr-xr-x 5 user user 4096 Jan 1 12:00 ..\n-rw-r--r-- 1 user user   42 Jan 1 12:00 test.txt';
            plan.steps[0].exit = 0;

            // 3. Get summary
            const summaryResult = await getSummary(JSON.stringify(plan));
            const summary = JSON.parse(summaryResult);

            expect(summary.achieve).toBe(true);
            expect(summary.summary).toContain('Successfully listed files');
        });

        it('should handle multi-step dependency workflow', async () => {
            const planResponse = {
                content: [
                    {
                        text: JSON.stringify({
                            explanation: 'Find and count Python files',
                            steps: [
                                {
                                    cmd: "find . -name '*.py'",
                                    output: '',
                                    exit: 0,
                                    executed: false,
                                    expectedDuration: 2000,
                                    dependsOnPreviousOutput: false,
                                },
                                {
                                    cmd: "find . -name '*.py' | wc -l",
                                    output: '',
                                    exit: 0,
                                    executed: false,
                                    expectedDuration: 1000,
                                    dependsOnPreviousOutput: true,
                                },
                            ],
                        }),
                    },
                ],
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => planResponse,
            } as Response);

            const planResult = await getPlan('find and count python files');
            const plan = JSON.parse(planResult);

            expect(plan.steps).toHaveLength(2);
            expect(plan.steps[0].dependsOnPreviousOutput).toBe(false);
            expect(plan.steps[1].dependsOnPreviousOutput).toBe(true);

            // Simulate step execution
            plan.steps[0].executed = true;
            plan.steps[0].output =
                './script1.py\n./utils/helper.py\n./tests/test_main.py';

            // Second step would depend on first step's output
            expect(plan.steps[1].cmd).toContain('|');
        });

        it('should handle error scenarios gracefully', async () => {
            const planResponse = {
                content: [
                    {
                        text: JSON.stringify({
                            explanation: 'Execute a command that will fail',
                            steps: [
                                {
                                    cmd: 'nonexistent-command',
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
            };

            const summaryResponse = {
                content: [
                    {
                        text: JSON.stringify({
                            achieve: false,
                            summary: 'Command failed: command not found',
                        }),
                    },
                ],
            };

            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => planResponse,
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => summaryResponse,
                } as Response);

            const planResult = await getPlan('run nonexistent command');
            const plan = JSON.parse(planResult);

            // Simulate command failure
            plan.steps[0].executed = true;
            plan.steps[0].output =
                'bash: nonexistent-command: command not found';
            plan.steps[0].exit = 127;

            const summaryResult = await getSummary(JSON.stringify(plan));
            const summary = JSON.parse(summaryResult);

            expect(summary.achieve).toBe(false);
            expect(summary.summary).toContain('Command failed');
        });
    });

    describe('Session Persistence', () => {
        it('should maintain session across WebSocket reconnections', done => {
            const sessionId = 'test-session-123';

            // First connection
            const ws1 = new MockWebSocket(
                `ws://localhost:3000/terminal?sessionId=${sessionId}`
            );

            ws1.addEventListener('open', () => {
                // Send authentication first
                const authMessage = JSON.stringify({
                    type: 'auth',
                    password: 'test-password',
                });

                ws1.addEventListener('message', (event: any) => {
                    const data = JSON.parse(event.data || event);
                    if (data.type === 'ready') {
                        expect(data.sessionId).toBe(sessionId);

                        // Close first connection
                        ws1.close();

                        // Create second connection with same session ID
                        const ws2 = new MockWebSocket(
                            `ws://localhost:3000/terminal?sessionId=${sessionId}`
                        );

                        ws2.addEventListener('open', () => {
                            // Authenticate the second connection
                            const authMessage2 = JSON.stringify({
                                type: 'auth',
                                password: 'test-password',
                            });

                            ws2.addEventListener('message', (event2: any) => {
                                const data2 = JSON.parse(event2.data || event2);
                                if (data2.type === 'ready') {
                                    expect(data2.sessionId).toBe(sessionId);
                                    ws2.close();
                                    done();
                                }
                            });

                            ws2.send(authMessage2);
                        });
                    }
                });

                ws1.send(authMessage);
            });
        });
    });

    describe('Performance and Reliability', () => {
        it('should handle multiple concurrent requests', async () => {
            const promises = Array.from({ length: 5 }, (_, i) => {
                const planResponse = {
                    content: [
                        {
                            text: JSON.stringify({
                                explanation: `Task ${i + 1}`,
                                steps: [
                                    {
                                        cmd: `echo "task ${i + 1}"`,
                                        output: '',
                                        exit: 0,
                                        executed: false,
                                        expectedDuration: 100,
                                        dependsOnPreviousOutput: false,
                                    },
                                ],
                            }),
                        },
                    ],
                };
                mockFetch.mockResolvedValueOnce({
                    ok: true,
                    json: async () => planResponse,
                } as Response);

                return getPlan(`task ${i + 1}`);
            });

            const results = await Promise.all(promises);

            expect(results).toHaveLength(5);
            results.forEach((result, i) => {
                const plan = JSON.parse(result);
                expect(plan.explanation).toBe(`Task ${i + 1}`);
            });
        });

        it('should handle timeout scenarios', async () => {
            // Mock a delayed response
            mockFetch.mockImplementationOnce(
                () =>
                    new Promise(resolve =>
                        setTimeout(
                            () =>
                                resolve({
                                    ok: true,
                                    json: async () => ({
                                        content: [
                                            {
                                                text: JSON.stringify({
                                                    explanation:
                                                        'Delayed response',
                                                    steps: [],
                                                }),
                                            },
                                        ],
                                    }),
                                } as Response),
                            100
                        )
                    )
            );

            const start = Date.now();
            const result = await getPlan('test with delay');
            const elapsed = Date.now() - start;

            expect(elapsed).toBeGreaterThan(90); // At least the delay time
            const plan = JSON.parse(result);
            expect(plan.explanation).toBe('Delayed response');
        });
    });
});
