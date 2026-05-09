import 'jest';

jest.mock('../src/config', () => ({
    getConfigManager: jest.fn(() => ({
        load: jest.fn().mockReturnValue({ apiToken: 'test-token' }),
        getConfigPath: jest.fn().mockReturnValue('/tmp/hiresquire.config.json'),
        isConfigured: jest.fn().mockReturnValue(true),
    })),
    saveConfig: jest.fn(),
}));