import 'jest';
import { resetLogger, setLogLevel } from '../src/shared/logger';

// Global test setup
beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset environment variables
    process.env.NODE_ENV = 'test';
    process.env.APP_PASSWORD = 'test-password';
    process.env.OPENAI_API_KEY = 'test-api-key';

    setLogLevel('silent');
});

afterEach(() => {
    resetLogger();
});

// Mock WebSocket globally for tests
global.WebSocket = jest.fn() as any;
