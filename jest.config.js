module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/server/**/*.test.js'],
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/test/**',
        '!**/node_modules/**',
    ],
    coverageDirectory: 'coverage-server',
    coverageReporters: ['text', 'lcov', 'html'],
    setupFilesAfterEnv: ['<rootDir>/server/test/setup.js'],
    testTimeout: 10000,
};
