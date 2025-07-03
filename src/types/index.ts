export interface SSHConnectionConfig {
    host: string;
    username: string;
    password: string;
    port: number;
}

export interface TerminalSession {
    id: string;
    host: string;
    port: number;
    username: string;
    isConnected: boolean;
    lastActive: number;
}

export interface WebSocketMessage {
    type: 'ready' | 'error' | 'ping' | 'pong' | 'data' | 'resize';
    sessionId?: string;
    message?: string;
    data?: string;
    cols?: number;
    rows?: number;
}

export interface AIMessage {
    id: string;
    content: string;
    isUser: boolean;
    timestamp: Date;
}

export interface CommandLog {
    command: string;
    output: string;
    timestamp: string;
    executionTime: number;
    sessionId: string;
}

export interface AuthResponse {
    ok: boolean;
    authenticated?: boolean;
}

export interface ConfigModalSettings {
    aiApiKey?: string;
    aiModel?: string;
    theme?: 'dark' | 'light';
}
