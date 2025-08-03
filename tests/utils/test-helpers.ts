import {
    MockSSHClient,
    MockSSHStream,
    MockWebSocket,
    MockAIService,
} from '../mocks';

/**
 * Test utilities for consistent test setup and data generation
 */
export class TestUtils {
    /**
     * Generate consistent test data for SSH connections
     */
    static generateSSHConfig(overrides: Partial<any> = {}) {
        return {
            host: 'test-host',
            port: 22,
            username: 'testuser',
            password: 'testpass',
            ...overrides,
        };
    }

    /**
     * Generate consistent test data for AI responses
     */
    static generateAIPlan(overrides: Partial<any> = {}) {
        return {
            explanation: 'Test plan explanation',
            steps: [
                {
                    cmd: "echo 'test'",
                    output: '',
                    exit: 0,
                    executed: false,
                    expectedDuration: 1000,
                    dependsOnPreviousOutput: false,
                },
            ],
            ...overrides,
        };
    }

    /**
     * Generate consistent test data for AI summaries
     */
    static generateAISummary(
        achieved: boolean = true,
        message: string = 'Test summary'
    ) {
        return {
            achieve: achieved,
            summary: message,
        };
    }

    /**
     * Create a mock SSH session with predictable behavior
     */
    static async createMockSSHSession(): Promise<{
        client: MockSSHClient;
        stream: MockSSHStream;
    }> {
        const client = new MockSSHClient();

        return new Promise((resolve, reject) => {
            client.on('ready', () => {
                client.shell({}, (err, stream) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ client, stream: stream as MockSSHStream });
                });
            });

            client.on('error', reject);

            client.connect(this.generateSSHConfig());
        });
    }

    /**
     * Create a mock WebSocket with authentication
     */
    static createAuthenticatedWebSocket(sessionId?: string): MockWebSocket {
        const url = sessionId
            ? `ws://localhost:3000/terminal?sessionId=${sessionId}`
            : 'ws://localhost:3000/terminal';

        return new MockWebSocket(url);
    }

    /**
     * Wait for specific event on an event emitter
     */
    static waitForEvent<T>(
        emitter: any,
        event: string,
        timeout: number = 5000
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout waiting for event: ${event}`));
            }, timeout);

            emitter.once(event, (data: T) => {
                clearTimeout(timer);
                resolve(data);
            });
        });
    }

    /**
     * Setup AI mocks for a complete workflow
     */
    static setupAIMocks(fetchMock: jest.MockedFunction<typeof fetch>) {
        const planResponse = {
            output: [
                {
                    content: [
                        {
                            text: JSON.stringify(this.generateAIPlan()),
                        },
                    ],
                },
            ],
        };

        const summaryResponse = {
            output: [
                {
                    content: [
                        {
                            text: JSON.stringify(this.generateAISummary()),
                        },
                    ],
                },
            ],
        };

        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                json: async () => planResponse,
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => summaryResponse,
            } as Response);
    }

    /**
     * Simulate command execution with realistic timing
     */
    static async simulateCommandExecution(
        stream: MockSSHStream,
        command: string,
        expectedOutput: string,
        exitCode: number = 0,
        delay: number = 10
    ): Promise<string> {
        return new Promise(resolve => {
            let output = '';

            const dataHandler = (data: Buffer) => {
                output += data.toString();
            };

            stream.on('data', dataHandler);

            setTimeout(() => {
                stream.off('data', dataHandler);
                resolve(output);
            }, delay);

            stream.write(command);
        });
    }

    /**
     * Create test environment with all mocks configured
     */
    static setupTestEnvironment() {
        // Reset all mocks
        jest.clearAllMocks();

        // Set test environment variables
        process.env.NODE_ENV = 'test';
        process.env.APP_PASSWORD = 'test-password';
        process.env.OPENAI_API_KEY = 'test-api-key';

        // Clear AI service mocks
        MockAIService.clearMockResponses();

        return {
            sshConfig: this.generateSSHConfig(),
            aiPlan: this.generateAIPlan(),
            aiSummary: this.generateAISummary(),
        };
    }

    /**
     * Generate realistic command execution scenarios
     */
    static getTestScenarios() {
        return {
            simpleCommands: [
                { cmd: 'pwd', output: '/home/testuser\n', exit: 0 },
                { cmd: 'whoami', output: 'testuser\n', exit: 0 },
                { cmd: 'echo "hello"', output: 'hello\n', exit: 0 },
                {
                    cmd: 'date',
                    output: 'Thu Jan  1 12:00:00 UTC 2025\n',
                    exit: 0,
                },
            ],

            fileOperations: [
                {
                    cmd: 'ls -la',
                    output: 'total 8\ndrwxr-xr-x 3 user user 4096 Jan 1 12:00 .\n',
                    exit: 0,
                },
                { cmd: 'cat test.txt', output: 'file content\n', exit: 0 },
                { cmd: 'touch newfile.txt', output: '', exit: 0 },
                {
                    cmd: 'rm nonexistent.txt',
                    output: "rm: cannot remove 'nonexistent.txt': No such file or directory\n",
                    exit: 1,
                },
            ],

            networkCommands: [
                {
                    cmd: 'ping -c 1 google.com',
                    output: 'PING google.com (172.217.3.14): 56 data bytes\n64 bytes from 172.217.3.14: icmp_seq=0 ttl=115 time=20.123 ms\n',
                    exit: 0,
                },
                {
                    cmd: 'curl -s http://httpbin.org/ip',
                    output: '{\n  "origin": "192.168.1.100"\n}\n',
                    exit: 0,
                },
            ],

            errorScenarios: [
                {
                    cmd: 'nonexistent-command',
                    output: 'bash: nonexistent-command: command not found\n',
                    exit: 127,
                },
                {
                    cmd: 'cat /root/restricted',
                    output: 'cat: /root/restricted: Permission denied\n',
                    exit: 1,
                },
                {
                    cmd: 'cd /nonexistent',
                    output: 'bash: cd: /nonexistent: No such file or directory\n',
                    exit: 1,
                },
            ],
        };
    }

    /**
     * Assert that AI response matches expected schema
     */
    static validateAIResponse(response: any, type: 'plan' | 'summary') {
        if (type === 'plan') {
            expect(response).toHaveProperty('explanation');
            expect(response).toHaveProperty('steps');
            expect(Array.isArray(response.steps)).toBe(true);

            response.steps.forEach((step: any) => {
                expect(step).toHaveProperty('cmd');
                expect(step).toHaveProperty('output');
                expect(step).toHaveProperty('exit');
                expect(step).toHaveProperty('executed');
                expect(step).toHaveProperty('expectedDuration');
                expect(step).toHaveProperty('dependsOnPreviousOutput');
            });
        } else if (type === 'summary') {
            expect(response).toHaveProperty('achieve');
            expect(response).toHaveProperty('summary');
            expect(typeof response.achieve).toBe('boolean');
            expect(typeof response.summary).toBe('string');
        }
    }
}
