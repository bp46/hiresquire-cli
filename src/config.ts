/**
 * HireSquire CLI - Configuration Management
 * 
 * Handles loading and saving configuration from file and environment variables
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config, ConfigFile } from './types';

// ============================================================================
// Constants
// ============================================================================

const CONFIG_FILE_NAME = 'config.json';
const ENV_TOKEN = 'HIRESQUIRE_API_TOKEN';
const ENV_BASE_URL = 'HIRESQUIRE_BASE_URL';
const ENV_WEBHOOK_URL = 'HIRESQUIRE_WEBHOOK_URL';

// ============================================================================
// Configuration Manager Class
// ============================================================================

export class ConfigManager {
    private configPath: string;
    private config: Config | null = null;

    constructor(customPath?: string) {
        const configDir = customPath || path.join(os.homedir(), '.hiresquire');
        this.configPath = path.join(configDir, CONFIG_FILE_NAME);
    }

    // ============================================================================
    // Public Methods
    // ============================================================================

    /**
     * Load configuration from file and environment
     */
    load(): Config {
        if (this.config) {
            return this.config;
        }

        // Priority: 1. Environment variables, 2. Config file, 3. Default
        const config: Config = {
            apiToken: process.env[ENV_TOKEN] || '',
            baseUrl: process.env[ENV_BASE_URL] || 'https://hiresquireai.com/api/v1',
            webhookUrl: process.env[ENV_WEBHOOK_URL] || undefined,
            defaultLeniency: 5,
        };

        // Load from file if exists
        const fileConfig = this.loadFromFile();
        if (fileConfig) {
            if (!process.env[ENV_TOKEN]) config.apiToken = fileConfig.apiToken || '';
            if (!process.env[ENV_BASE_URL]) config.baseUrl = fileConfig.baseUrl || config.baseUrl;
            config.webhookUrl = fileConfig.webhookUrl || config.webhookUrl;
            config.defaultLeniency = fileConfig.defaultLeniency || 5;
        }

        this.config = config;
        return config;
    }

    /**
     * Save configuration to file
     */
    save(config: Partial<Config>): void {
        const currentConfig = this.load();
        const newConfig: Config = {
            apiToken: config.apiToken || currentConfig.apiToken,
            baseUrl: config.baseUrl || currentConfig.baseUrl,
            webhookUrl: config.webhookUrl !== undefined ? config.webhookUrl : currentConfig.webhookUrl,
            defaultLeniency: config.defaultLeniency || currentConfig.defaultLeniency,
        };

        // Ensure directory exists
        const dir = path.dirname(this.configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Save to file
        const configFile: ConfigFile = {
            apiToken: newConfig.apiToken,
            baseUrl: newConfig.baseUrl,
            webhookUrl: newConfig.webhookUrl,
            defaultLeniency: newConfig.defaultLeniency,
        };

        fs.writeFileSync(this.configPath, JSON.stringify(configFile, null, 2));
        
        // Set restricted permissions (0600 - owner read/write only)
        try {
            fs.chmodSync(this.configPath, 0o600);
        } catch (error) {
            // Ignore chmod errors on systems that don't support it (e.g. some Windows environments)
        }

        this.config = newConfig;
    }

    /**
     * Clear configuration
     */
    clear(): void {
        if (fs.existsSync(this.configPath)) {
            fs.unlinkSync(this.configPath);
        }
        this.config = null;
    }

    /**
     * Get current config
     */
    get(): Config | null {
        return this.config;
    }

    /**
     * Check if configured (has API token)
     */
    isConfigured(): boolean {
        const config = this.load();
        return !!config.apiToken;
    }

    /**
     * Get config file path
     */
    getConfigPath(): string {
        return this.configPath;
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private loadFromFile(): ConfigFile | null {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                return JSON.parse(content);
            }
        } catch (error) {
            // Ignore errors, return null
        }
        return null;
    }
}

// ============================================================================
// Factory
// ============================================================================

let defaultConfigManager: ConfigManager | null = null;

/**
 * Get default config manager instance
 */
export function getConfigManager(customPath?: string): ConfigManager {
    if (!defaultConfigManager) {
        defaultConfigManager = new ConfigManager(customPath);
    }
    return defaultConfigManager;
}

/**
 * Get configuration (shorthand)
 */
export function getConfig(): Config {
    return getConfigManager().load();
}

/**
 * Save configuration (shorthand)
 */
export function saveConfig(config: Partial<Config>): void {
    getConfigManager().save(config);
}
