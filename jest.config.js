module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/__tests__/**'
    ],
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js'
    ],
    testTimeout: 10000,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    verbose: true
};
