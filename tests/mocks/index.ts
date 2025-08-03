import { EventEmitter } from 'events';

/**
 * Mock SSH Stream that simulates terminal behavior
 */
export class MockSSHStream extends EventEmitter {
    private _cols: number = 80;
    private _rows: number = 24;

    constructor() {
        super();
    }

    write(data: string): void {
        // Simulate command execution with predictable responses
        this.simulateCommandResponse(data);
    }

    setWindow(rows: number, cols: number): void {
        this._rows = rows;
        this._cols = cols;
    }

    end(): void {
        this.emit('close');
    }

    private simulateCommandResponse(command: string): void {
        // Simulate different command responses for testing
        setTimeout(() => {
            const trimmedCommand = command.trim();

            if (trimmedCommand === 'echo "hello"') {
                this.emit('data', Buffer.from('hello\n'));
            } else if (trimmedCommand === 'pwd') {
                this.emit('data', Buffer.from('/home/testuser\n'));
            } else if (trimmedCommand === 'ls') {
                this.emit(
                    'data',
                    Buffer.from('file1.txt\nfile2.txt\nfolder1\n')
                );
            } else if (trimmedCommand.startsWith('cat ')) {
                this.emit('data', Buffer.from('file content\n'));
            } else if (trimmedCommand === 'whoami') {
                this.emit('data', Buffer.from('testuser\n'));
            } else if (trimmedCommand.startsWith('sleep')) {
                // Simulate long-running command
                setTimeout(() => {
                    this.emit('data', Buffer.from('sleep completed\n'));
                }, 100);
            } else if (trimmedCommand.includes('error')) {
                this.emit('data', Buffer.from('command not found\n'));
                this.stderr.emit(
                    'data',
                    Buffer.from('error: command failed\n')
                );
            } else {
                // Default response for unknown commands
                this.emit('data', Buffer.from(`${trimmedCommand}\n`));
            }
        }, 10); // Small delay to simulate network latency
    }

    stderr = new EventEmitter();
}

/**
 * Mock SSH Client that creates predictable connections
 */
export class MockSSHClient extends EventEmitter {
    private _ready: boolean = false;

    connect(config: any): this {
        // Simulate connection delay
        setTimeout(() => {
            if (config.host === 'invalid-host') {
                this.emit('error', new Error('Connection failed'));
                return;
            }

            this._ready = true;
            this.emit('ready');
        }, 10);

        return this;
    }

    shell(
        options: any,
        callback: (err: Error | null, stream?: MockSSHStream) => void
    ): void {
        if (!this._ready) {
            callback(new Error('Connection not ready'));
            return;
        }

        setTimeout(() => {
            const stream = new MockSSHStream();
            callback(null, stream);
        }, 5);
    }

    end(): void {
        this._ready = false;
        this.emit('end');
    }
}

/**
 * Mock AI API responses for consistent testing
 */
export class MockAIService {
    private static responses: Map<string, any> = new Map();

    static setMockResponse(prompt: string, response: any): void {
        this.responses.set(prompt, response);
    }

    static getMockResponse(prompt: string): any {
        return (
            this.responses.get(prompt) || {
                output: [
                    {
                        content: [
                            {
                                text: JSON.stringify({
                                    explanation: 'Mock AI response',
                                    steps: [
                                        {
                                            cmd: "echo 'mock command'",
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
            }
        );
    }

    static clearMockResponses(): void {
        this.responses.clear();
    }
}

/**
 * Mock WebSocket for testing real-time communication
 */
export class MockWebSocket extends EventEmitter {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState: number = MockWebSocket.CONNECTING;
    private _listeners: Map<string, Function[]> = new Map();

    constructor(url: string) {
        super();

        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            this.emit('open');
        }, 10);
    }

    send(data: string): void {
        if (this.readyState !== MockWebSocket.OPEN) {
            throw new Error('WebSocket is not open');
        }

        // Echo back for testing
        setTimeout(() => {
            this.emit('message', data);
        }, 5);
    }

    close(): void {
        this.readyState = MockWebSocket.CLOSED;
        this.emit('close');
    }

    addEventListener(event: string, listener: Function): void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event)!.push(listener);
        this.on(event, listener as any);
    }

    removeEventListener(event: string, listener: Function): void {
        this.off(event, listener as any);
    }
}
