# Testing Strategy for Jarvis Terminal

## Overview

This testing framework addresses the unique challenges of testing an SSH terminal tool with AI backend integration. The main challenges are:

1. **Non-deterministic SSH connections** - Variable timing and responses
2. **Non-deterministic AI responses** - Different outputs for same inputs
3. **Real-time WebSocket communication** - Complex async behavior
4. **Session persistence** - State management across connections

## Testing Philosophy

### Mocking Strategy

Instead of relying on real SSH servers and AI APIs (which would make tests flaky and unreliable), we use sophisticated mocks that:

- **Provide deterministic responses** for consistent test results
- **Simulate realistic timing** to catch race conditions
- **Cover error scenarios** that would be hard to reproduce with real systems
- **Enable fast test execution** without network dependencies

### Test Categories

#### 1. Unit Tests

- **Authentication**: Login, logout, session validation
- **SSH Connection Management**: Connection, error handling, cleanup
- **AI Integration**: Plan generation, summary creation, error handling
- **WebSocket Communication**: Message handling, connection lifecycle

#### 2. Integration Tests

- **WebSocket + SSH**: End-to-end terminal communication
- **AI + Command Execution**: Complete Jarvis workflow
- **Session Persistence**: Reconnection scenarios

#### 3. End-to-End Tests

- **Complete User Workflows**: From AI request to command execution
- **Error Recovery**: Handling failures gracefully
- **Performance**: Concurrent usage, timeout handling

## Mock Infrastructure

### MockSSHClient & MockSSHStream

- Simulates SSH2 library behavior
- Provides predictable command responses
- Includes realistic timing delays
- Supports error injection for testing edge cases

### MockAIService

- Provides deterministic AI responses
- Supports different response scenarios
- Enables testing of malformed responses
- Simulates API rate limiting and errors

### MockWebSocket

- Replicates WebSocket API behavior
- Supports connection lifecycle events
- Enables testing of message handling
- Simulates network issues

## Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI (no watch, with coverage)
npm run test:ci
```

## Test Structure

```
tests/
├── setup.ts              # Global test configuration
├── mocks/
│   └── index.ts          # Mock implementations
├── backend/
│   ├── auth.test.ts      # Authentication tests
│   └── ssh.test.ts       # SSH connection tests
├── frontend/
│   └── ai.test.ts        # AI integration tests
├── integration/
│   └── websocket.test.ts # WebSocket integration tests
├── e2e/
│   └── complete-workflow.test.ts # End-to-end scenarios
└── utils/
    └── test-helpers.ts   # Test utilities and helpers
```

## Key Testing Patterns

### 1. Deterministic Command Responses

```typescript
// Instead of real SSH, use predictable responses
mockStream.write('ls');
expect(mockStream).toEmit('data', 'file1.txt\nfile2.txt\n');
```

### 2. AI Response Mocking

```typescript
// Mock AI API to return consistent plans
MockAIService.setMockResponse('list files', {
  explanation: "List files in directory",
  steps: [{ cmd: "ls -la", ... }]
});
```

### 3. Async Event Testing

```typescript
// Use test utilities to wait for specific events
await TestUtils.waitForEvent(mockStream, 'data');
```

### 4. Error Scenario Coverage

```typescript
// Test both success and failure paths
mockClient.connect({ host: 'invalid-host' });
expect(mockClient).toEmit('error');
```

## Benefits of This Approach

1. **Reliability**: Tests always produce the same results
2. **Speed**: No network delays or external dependencies
3. **Coverage**: Can test error scenarios that are hard to reproduce
4. **Maintainability**: Tests don't break when external services change
5. **Development**: Fast feedback loop during development

## Continuous Integration

The test suite runs automatically on:

- Every push to main/develop branches
- Every pull request
- Multiple Node.js versions (18.x, 20.x)

### CI Pipeline includes:

- TypeScript compilation checks
- Full test suite execution
- Code coverage reporting
- Security audit
- Code formatting validation

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the system should do, not how it does it
2. **Use Realistic Mocks**: Mocks should behave like real systems
3. **Test Error Paths**: Don't just test the happy path
4. **Keep Tests Fast**: Use mocks to avoid slow network operations
5. **Make Tests Readable**: Use descriptive test names and clear assertions

## Future Enhancements

1. **Visual Regression Testing**: For frontend UI components
2. **Load Testing**: Simulate many concurrent users
3. **Contract Testing**: Ensure AI API compatibility
4. **Mutation Testing**: Verify test quality
5. **Property-Based Testing**: Generate test cases automatically

This testing strategy ensures that you can refactor and add features with confidence, knowing that any breaking changes will be caught by the comprehensive test suite.
