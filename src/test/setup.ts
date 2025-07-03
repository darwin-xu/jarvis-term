import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
}));

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
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
