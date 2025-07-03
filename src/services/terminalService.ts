import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebSocketMessage, SSHConnectionConfig, CommandLog } from '../types';

class TerminalService {
    private terminal: Terminal | null = null;
    private websocket: WebSocket | null = null;
    private fitAddon: FitAddon | null = null;
    private sessionId: string | null = null;
    private connectionConfig: SSHConnectionConfig | null = null;
    private onStatusChange?: (
        status: 'connected' | 'connecting' | 'disconnected',
        message?: string
    ) => void;

    /**
     * Initialize terminal instance
     */
    initTerminal(container: HTMLElement): Terminal {
        this.terminal = new Terminal({
            theme: {
                background: '#1e1e1e',
                foreground: '#ffffff',
                cursor: '#ffffff',
                selectionBackground: '#ffffff40',
            },
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            fontSize: 14,
            rows: 24,
            cols: 80,
            scrollback: 1000,
            allowTransparency: true,
        });

        this.fitAddon = new FitAddon();
        this.terminal.loadAddon(this.fitAddon);
        this.terminal.loadAddon(new WebLinksAddon());

        this.terminal.open(container);
        this.terminal.focus();

        // Fit terminal to container
        this.fitAddon.fit();

        // Handle resize events
        window.addEventListener('resize', () => {
            if (this.fitAddon && this.terminal) {
                this.fitAddon.fit();
                this.sendResize();
            }
        });

        return this.terminal;
    }

    /**
     * Connect to SSH server via WebSocket
     */
    connect(
        config: SSHConnectionConfig,
        onStatusChange?: (
            status: 'connected' | 'connecting' | 'disconnected',
            message?: string
        ) => void
    ): void {
        this.connectionConfig = config;
        this.onStatusChange = onStatusChange;

        if (this.websocket) {
            this.disconnect();
        }

        this.onStatusChange?.('connecting', 'Connecting to server...');

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/terminal?host=${encodeURIComponent(config.host)}&user=${encodeURIComponent(config.username)}&pass=${encodeURIComponent(config.password)}&port=${config.port}`;

        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            console.log('WebSocket connected');
        };

        this.websocket.onmessage = event => {
            this.handleWebSocketMessage(event.data);
        };

        this.websocket.onclose = event => {
            console.log('WebSocket closed:', event.code, event.reason);
            this.onStatusChange?.('disconnected', 'Connection closed');
            this.sessionId = null;
        };

        this.websocket.onerror = error => {
            console.error('WebSocket error:', error);
            this.onStatusChange?.('disconnected', 'Connection error');
        };

        // Handle terminal input
        if (this.terminal) {
            this.terminal.onData((data: string) => {
                this.sendData(data);
            });
        }
    }

    /**
     * Disconnect from SSH server
     */
    disconnect(): void {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.sessionId = null;
        this.onStatusChange?.('disconnected', 'Disconnected');
    }

    /**
     * Terminate current session
     */
    async terminateSession(): Promise<void> {
        if (!this.sessionId) return;

        try {
            await fetch('/sessions/terminate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId: this.sessionId }),
            });
        } catch (error) {
            console.error('Error terminating session:', error);
        }

        this.disconnect();
    }

    /**
     * Execute command and log it
     */
    async executeCommand(command: string): Promise<void> {
        if (!this.terminal || !this.sessionId) return;

        const startTime = Date.now();

        // Send command to terminal
        this.sendData(command + '\r');

        // Log the command (simplified - in real implementation you'd capture the output)
        const logEntry: CommandLog = {
            command,
            output: '', // Would need to capture actual output
            timestamp: new Date().toISOString(),
            executionTime: Date.now() - startTime,
            sessionId: this.sessionId,
        };

        try {
            await fetch('/api/command-log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logEntry),
            });
        } catch (error) {
            console.error('Error logging command:', error);
        }
    }

    /**
     * Resize terminal
     */
    resize(): void {
        if (this.fitAddon) {
            this.fitAddon.fit();
            this.sendResize();
        }
    }

    /**
     * Get current terminal dimensions
     */
    getDimensions(): { cols: number; rows: number } {
        if (!this.terminal) {
            return { cols: 80, rows: 24 };
        }
        return {
            cols: this.terminal.cols,
            rows: this.terminal.rows,
        };
    }

    /**
     * Handle WebSocket messages
     */
    private handleWebSocketMessage(data: string): void {
        try {
            const message: WebSocketMessage = JSON.parse(data);

            switch (message.type) {
                case 'ready':
                    this.sessionId = message.sessionId || null;
                    this.onStatusChange?.(
                        'connected',
                        `Connected to ${this.connectionConfig?.host}`
                    );
                    this.sendResize(); // Send initial terminal size
                    break;

                case 'error':
                    this.onStatusChange?.(
                        'disconnected',
                        message.message || 'Connection error'
                    );
                    break;

                case 'ping':
                    this.sendMessage({ type: 'pong' });
                    break;

                default:
                    // Handle data messages
                    if (this.terminal) {
                        this.terminal.write(data);
                    }
                    break;
            }
        } catch {
            // If not JSON, treat as terminal data
            if (this.terminal) {
                this.terminal.write(data);
            }
        }
    }

    /**
     * Send data to WebSocket
     */
    private sendData(data: string): void {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.sendMessage({ type: 'data', data });
        }
    }

    /**
     * Send resize information
     */
    private sendResize(): void {
        if (
            this.terminal &&
            this.websocket &&
            this.websocket.readyState === WebSocket.OPEN
        ) {
            const dimensions = this.getDimensions();
            this.sendMessage({
                type: 'resize',
                cols: dimensions.cols,
                rows: dimensions.rows,
            });
        }
    }

    /**
     * Send message to WebSocket
     */
    private sendMessage(message: WebSocketMessage): void {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        }
    }
}

export const terminalService = new TerminalService();
