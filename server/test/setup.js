// Test setup for backend tests
const { TextEncoder, TextDecoder } = require('util');

// Make TextEncoder and TextDecoder available globally for Node.js tests
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.APP_PASSWORD = 'test-password';
process.env.SESSION_TIMEOUT_MIN = '1';
process.env.PORT = '3001';

// Mock console methods for cleaner test output
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
};
