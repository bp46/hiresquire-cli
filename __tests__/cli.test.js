"use strict";
const path = require('path');
const fs = require('fs');
describe('CLI Build', () => {
    test('should compile TypeScript successfully', () => {
        const distIndex = path.join(__dirname, '../dist/index.js');
        const distApi = path.join(__dirname, '../dist/api.js');
        expect(fs.existsSync(distIndex)).toBe(true);
        expect(fs.existsSync(distApi)).toBe(true);
    });
    test('dist should have retry logic', () => {
        const apiContent = fs.readFileSync(path.join(__dirname, '../dist/api.js'), 'utf-8');
        expect(apiContent).toContain('MAX_RETRIES');
        expect(apiContent).toContain('retry');
    });
    test('dist should have file size limit', () => {
        const apiContent = fs.readFileSync(path.join(__dirname, '../dist/api.js'), 'utf-8');
        expect(apiContent).toContain('MAX_FILE_SIZE');
        expect(apiContent).toContain('File too large');
    });
});
describe('CLI Package', () => {
    test('package.json should have correct structure', () => {
        const pkg = require('../package.json');
        expect(pkg.name).toBe('hiresquire-cli');
        expect(pkg.bin).toBeDefined();
        expect(pkg.bin.hiresquire).toBe('./bin/hiresquire');
    });
    test('should have all required dependencies', () => {
        const pkg = require('../package.json');
        expect(pkg.dependencies).toHaveProperty('axios');
        expect(pkg.dependencies).toHaveProperty('commander');
        expect(pkg.dependencies).toHaveProperty('chalk');
    });
});
describe('CLI Bin', () => {
    test('bin script should exist and be executable', () => {
        const binPath = path.join(__dirname, '../bin/hiresquire');
        expect(fs.existsSync(binPath)).toBe(true);
    });
});
//# sourceMappingURL=cli.test.js.map