import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock WebSocket with correct class signature for TypeScript
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = MockWebSocket.OPEN;
    CONNECTING = MockWebSocket.CONNECTING;
    OPEN = MockWebSocket.OPEN;
    CLOSING = MockWebSocket.CLOSING;
    CLOSED = MockWebSocket.CLOSED;
    send = vi.fn();
    close = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    // Accept url and protocols to match signature, but do not declare them to avoid TS6133
    constructor(..._args: any[]) {}
}
// @ts-ignore
global.WebSocket = MockWebSocket;

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage with required properties for TypeScript
const localStorageMock: Storage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
};
// @ts-ignore
global.localStorage = localStorageMock;

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock environment variables
vi.mock('import.meta', () => ({
    env: {
        VITE_SSH_HOST: 'localhost',
        VITE_SSH_USER: 'testuser',
        VITE_SSH_PASS: 'testpass',
        VITE_SSH_PORT: '22',
    },
}));

// Clean up after each test
afterEach(() => {
    vi.clearAllMocks();
});
