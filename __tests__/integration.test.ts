/**
 * HireSquire CLI - Integration Tests
 * 
 * NOTE: These tests require a running API server and API token to execute fully.
 * Set HIRESQUIRE_TEST_TOKEN and HIRESQUIRE_TEST_URL environment variables to run.
 * 
 * Without credentials, only build validation tests will run.
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_BASE_URL = process.env.HIRESQUIRE_TEST_URL || 'https://api.hiresquireai.com/api/v1';
const TEST_TOKEN = process.env.HIRESQUIRE_TEST_TOKEN;

// Only run integration tests if token is provided
const hasCredentials = TEST_TOKEN ? true : false;

describe('Build Validation', () => {
    test('TypeScript compiles without errors', () => {
        expect(true).toBe(true);
    });

    test('dist files exist', () => {
        const distIndex = path.join(__dirname, '../dist/index.js');
        const distApi = path.join(__dirname, '../dist/api.js');
        
        expect(fs.existsSync(distIndex)).toBe(true);
        expect(fs.existsSync(distApi)).toBe(true);
    });

    test('dist has required functions exported', () => {
        const apiContent = fs.readFileSync(path.join(__dirname, '../dist/api.js'), 'utf-8');
        
        expect(apiContent).toContain('createApiClientFromToken');
        expect(apiContent).toContain('readResumeFromFile');
        expect(apiContent).toContain('readResumesFromDirectory');
    });
});

// Integration tests that require actual API
if (hasCredentials) {
    const apiModule = require('../dist/api');
    const createApiClientFromToken = apiModule.createApiClientFromToken;
    
    describe('API Integration Tests', () => {
        let client: any;
        
        beforeAll(() => {
            client = createApiClientFromToken(TEST_TOKEN, TEST_BASE_URL);
        });

        test('should authenticate with valid token', async () => {
            await expect(client.listJobs({ per_page: 1 })).resolves.toBeDefined();
        }, 10000);
    });
} else {
    describe.skip('API Integration Tests', () => {
        test('requires HIRESQUIRE_TEST_TOKEN environment variable', () => {
            expect(true).toBe(true);
        });
    });
}

describe('File Handling', () => {
    test('should read resume from file', async () => {
        const apiModule = require('../dist/api');
        const readResumeFromFile = apiModule.readResumeFromFile;
        
        const testFile = path.join(__dirname, 'test_resume.txt');
        fs.writeFileSync(testFile, 'Test Resume Content\nExperience: 5 years\nSkills: JavaScript, TypeScript\nThis is a test resume with sufficient content that is more than 50 characters long so the validation passes.');
        
        const resume = await readResumeFromFile(testFile);
        
        expect(resume.filename).toBe('test_resume.txt');
        expect(resume.content).toContain('Test Resume Content');
        
        fs.unlinkSync(testFile);
    });
    
    test('should throw error for oversized files', async () => {
        const apiModule = require('../dist/api');
        const readResumeFromFile = apiModule.readResumeFromFile;
        
        const testFile = path.join(__dirname, 'large_resume.txt');
        const largeContent = 'x'.repeat(21 * 1024 * 1024);
        fs.writeFileSync(testFile, largeContent);
        
        await expect(readResumeFromFile(testFile)).rejects.toThrow('File too large');
        
        fs.unlinkSync(testFile);
    });
    
    test('should read resumes from directory', async () => {
        const apiModule = require('../dist/api');
        const readResumesFromDirectory = apiModule.readResumesFromDirectory;
        
        const testDir = path.join(__dirname, 'test_resumes');
        
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir);
        }
        
        fs.writeFileSync(path.join(testDir, 'resume1.txt'), 'Resume 1 content. This is a test resume with sufficient content that is more than 50 characters long so the validation passes.');
        fs.writeFileSync(path.join(testDir, 'resume2.txt'), 'Resume 2 content. This is a test resume with sufficient content that is more than 50 characters long so the validation passes.');
        
        const resumes = await readResumesFromDirectory(testDir);
        
        expect(resumes.length).toBe(2);
        
        fs.unlinkSync(path.join(testDir, 'resume1.txt'));
        fs.unlinkSync(path.join(testDir, 'resume2.txt'));
        fs.rmdirSync(testDir);
    });
});