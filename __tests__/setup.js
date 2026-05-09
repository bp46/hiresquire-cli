"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
jest.mock('../src/config', () => ({
    getConfigManager: jest.fn(() => ({
        load: jest.fn().mockReturnValue({ apiToken: 'test-token' }),
        getConfigPath: jest.fn().mockReturnValue('/tmp/hiresquire.config.json'),
        isConfigured: jest.fn().mockReturnValue(true),
    })),
    saveConfig: jest.fn(),
}));
jest.mock('../src/api', () => ({
    createApiClient: jest.fn(() => ({
        createJob: jest.fn().mockResolvedValue({ job_id: 123, status: 'processing' }),
        listJobs: jest.fn().mockResolvedValue({ jobs: [], total: 0, page: 1 }),
        getResults: jest.fn().mockResolvedValue({ job_id: 123, candidates: [] }),
        getJobStatus: jest.fn().mockResolvedValue({ job_id: 123, status: 'processing' }),
        pollForCompletion: jest.fn().mockResolvedValue({ job_id: 123, status: 'completed' }),
        generateEmail: jest.fn().mockResolvedValue({ success: true }),
    })),
    readResumesFromPaths: jest.fn().mockReturnValue([]),
}));
//# sourceMappingURL=setup.js.map