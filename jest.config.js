module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/?(*.)+(spec|test).ts',
    ],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                "target": "ES2020",
                "module": "commonjs",
                "lib": ["ES2020"],
                "types": ["jest", "node"],
                "esModuleInterop": true,
                "skipLibCheck": true,
                "forceConsistentCasingInFileNames": true,
                "resolveJsonModule": true
            }
        }]
    },
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/__tests__/**',
        '!src/index.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    testTimeout: 30000,
};