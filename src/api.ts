/**
 * HireSquire CLI - API Client
 * 
 * HTTP client for interacting with the HireSquire API
 * Handles authentication, request/response typing, and error handling
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import officeParser from 'officeparser';
import FormData from 'form-data';
import {
    Config,
    CreateJobParams,
    CreateJobResponse,
    JobStatusResponse,
    ResultsResponse,
    JobsListResponse,
    EmailParams,
    EmailResponse,
    HireSquireError,
    AuthenticationError,
    ValidationError,
    RateLimitError,
    NotFoundError,
    Resume,
    CalendarConnection,
    CreateCalendarConnectionParams,
    Interview,
    CreateInterviewParams,
    MeetingLinkResponse,
    AvailableSlotsResponse,
} from './types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_BASE_URL = 'https://hiresquireai.com/api/v1';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB max file size

// ============================================================================
// API Client Class
// ============================================================================

export class ApiClient {
    private client: AxiosInstance;
    private config: Config;

    constructor(config: Config) {
        this.config = {
            ...config,
            baseUrl: config.baseUrl || DEFAULT_BASE_URL,
        };

        this.client = axios.create({
            baseURL: this.config.baseUrl.endsWith('/') ? this.config.baseUrl : `${this.config.baseUrl}/`,
            timeout: DEFAULT_TIMEOUT,
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'hiresquire-cli/1.2.4',
            },
        });

        // Add response interceptor for error handling with retry
        this.client.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };
                
                if (!originalRequest) {
                    throw this.handleError(error);
                }

                const shouldRetry = this.shouldRetryRequest(error);
                const retryCount = originalRequest._retryCount || 0;

                if (shouldRetry && retryCount < MAX_RETRIES) {
                    originalRequest._retryCount = retryCount + 1;
                    const delay = RETRY_DELAY * Math.pow(2, retryCount);
                    await this.sleep(delay);
                    return this.client(originalRequest);
                }

                throw this.handleError(error);
            }
        );
    }

    private shouldRetryRequest(error: AxiosError): boolean {
        const statusCode = error.response?.status;
        const code = error.code;
        // Retry on: rate limit, server errors, timeouts, and network errors
        const retryableCodes = ['ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
        return statusCode === 429 || statusCode === 503 || statusCode === 500 || retryableCodes.includes(code || '');
    }

    // ============================================================================
    // Error Handling
    // ============================================================================

    private handleError(error: AxiosError): HireSquireError {
        const statusCode = error.response?.status;
        const responseData = error.response?.data as Record<string, unknown> | undefined;
        const message = responseData?.message as string || responseData?.error as string || error.message;

        switch (statusCode) {
            case 401:
            case 403:
                return new AuthenticationError(message);
            case 400:
                return new ValidationError(message);
            case 404:
                return new NotFoundError(message);
            case 429:
                const retryAfter = error.response?.headers['retry-after'];
                return new RateLimitError(
                    message + (retryAfter ? ` Retry after ${retryAfter} seconds.` : '')
                );
            case 422:
                return new ValidationError(message);
            default:
                return new HireSquireError(message, 'API_ERROR', statusCode);
        }
    }

    // ============================================================================
    // Job Operations
    // ============================================================================

    /**
     * Generic GET request
     */
    async get<T = any>(url: string, config?: any): Promise<{ data: T }> {
        const response = await this.client.get<T>(url, config);
        return { data: response.data };
    }

    /**
     * Generic POST request
     */
    async post<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
        const response = await this.client.post<T>(url, data, config);
        return { data: response.data };
    }

    /**
     * Generic PUT request
     */
    async put<T = any>(url: string, data?: any, config?: any): Promise<{ data: T }> {
        const response = await this.client.put<T>(url, data, config);
        return { data: response.data };
    }

    /**
     * Generic DELETE request
     */
    async delete<T = any>(url: string, config?: any): Promise<{ data: T }> {
        const response = await this.client.delete<T>(url, config);
        return { data: response.data };
    }

    /**
     * Create a new screening job
     */
    async createJob(params: CreateJobParams): Promise<CreateJobResponse> {
        const idempotencyKey = params.idempotency_key || crypto.randomUUID();
        const response = await this.client.post<CreateJobResponse>('jobs', params, {
            headers: {
                'Idempotency-Key': idempotencyKey
            }
        });
        return response.data;
    }

    /**
     * Upload a ZIP file containing resumes to create a new screening job
     */
    async uploadZip(
        params: Omit<CreateJobParams, 'resumes'> & { zipPath: string }
    ): Promise<CreateJobResponse> {
        const formData = new FormData();
        formData.append('title', params.title);
        formData.append('description', params.description);
        
        if (params.leniency_level !== undefined) {
            formData.append('leniency_level', params.leniency_level.toString());
        }
        
        if (params.custom_instructions) {
            formData.append('custom_instructions', params.custom_instructions);
        }
        
        if (params.webhook_url) {
            formData.append('webhook_url', params.webhook_url);
        }
        
        // Append the zip file
        formData.append('zip_file', fs.createReadStream(params.zipPath));

        const idempotencyKey = params.idempotency_key || crypto.randomUUID();

        const response = await this.client.post<CreateJobResponse>('jobs/upload-zip', formData, {
            headers: {
                ...formData.getHeaders(),
                'Idempotency-Key': idempotencyKey
            }
        });
        return response.data;
    }

    /**
     * Get job status
     */
    async getJobStatus(jobId: number): Promise<JobStatusResponse> {
        const response = await this.client.get<JobStatusResponse>(`jobs/${jobId}`);
        return response.data;
    }

    /**
     * Get job results
     */
    async getResults(
        jobId: number,
        options: { min_score?: number; only_top_n?: number } = {}
    ): Promise<ResultsResponse> {
        const params = new URLSearchParams();
        if (options.min_score) params.append('min_score', options.min_score.toString());
        if (options.only_top_n) params.append('only_top_n', options.only_top_n.toString());

        const queryString = params.toString();
        const url = queryString
            ? `jobs/${jobId}/results?${queryString}`
            : `jobs/${jobId}/results`;

        const response = await this.client.get<ResultsResponse>(url);
        return response.data;
    }

    /**
     * List all jobs
     */
    async listJobs(options: {
        status?: string;
        page?: number;
        per_page?: number;
    } = {}): Promise<JobsListResponse> {
        const params = new URLSearchParams();
        if (options.status) params.append('status', options.status);
        if (options.page) params.append('page', options.page.toString());
        if (options.per_page) params.append('per_page', options.per_page.toString());

        const queryString = params.toString();
        const url = queryString ? `jobs?${queryString}` : 'jobs';

        const response = await this.client.get<JobsListResponse>(url);
        return response.data;
    }

    // ============================================================================
    // Email Operations
    // ============================================================================

    /**
     * Generate an email for a candidate
     */
    async generateEmail(params: EmailParams): Promise<EmailResponse> {
        const response = await this.client.post<EmailResponse>(
            `jobs/${params.job_id}/generate-email`,
            {
                candidate_id: params.candidate_id,
                type: params.type,
                custom_message: params.custom_message,
            }
        );
        return response.data;
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * Poll for job completion
     */
    async pollForCompletion(
        jobId: number,
        options: {
            interval?: number;
            timeout?: number;
            onProgress?: (status: JobStatusResponse) => void;
        } = {}
    ): Promise<JobStatusResponse> {
        const interval = options.interval || 3000; // 3 seconds
        const timeout = options.timeout || 300000; // 5 minutes
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const status = await this.getJobStatus(jobId);

            if (options.onProgress) {
                options.onProgress(status);
            }

            if (status.status === 'completed' || status.status === 'failed') {
                return status;
            }

            await this.sleep(interval);
        }

        throw new HireSquireError(
            `Job polling timed out after ${timeout / 1000} seconds`,
            'TIMEOUT'
        );
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Test API connection
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.listJobs({ per_page: 1 });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get current config
     */
    getConfig(): Config {
        return { ...this.config };
    }

    // ============================================================================
    // Job Control
    // ============================================================================

    /**
     * Cancel a running job
     */
    async cancelJob(jobId: number): Promise<{ job_id: number; status: string; message: string }> {
        const response = await this.client.post<{ job_id: number; status: string; message: string }>(
            `jobs/${jobId}/cancel`
        );
        return response.data;
    }

    /**
     * Compare multiple candidates side-by-side
     */
    async compareCandidates(
        jobId: number,
        candidateIds: number[]
    ): Promise<{
        job_id: number;
        candidates: Array<{ id: number; name: string; score: number; summary: string }>;
        comparison: { top_candidate: string; score_diff: number };
    }> {
        const response = await this.client.get<any>(
            `jobs/${jobId}/compare?ids=${candidateIds.join(',')}`
        );
        return response.data;
    }

    /**
     * Report hiring outcome to improve AI accuracy
     */
    async reportOutcome(
        jobId: number,
        candidateId: number,
        outcome: 'hired' | 'rejected' | 'withdrawn'
    ): Promise<{ success: boolean; message: string }> {
        const response = await this.client.post<{ success: boolean; message: string }>(
            `jobs/${jobId}/outcome`,
            { candidate_id: candidateId, outcome }
        );
        return response.data;
    }

    // ============================================================================
    // Webhook
    // ============================================================================

    /**
     * Test a webhook endpoint
     */
    async testWebhook(webhookUrl: string): Promise<{ success: boolean; message: string; response_code?: number }> {
        const response = await this.client.post<any>('webhooks/test', { url: webhookUrl });
        return response.data;
    }

    // ============================================================================
    // Rate Limit
    // ============================================================================

    /**
     * Get current rate limit status
     */
    async getRateLimit(): Promise<{
        limit: number;
        remaining: number;
        reset_at: string;
        reset_in_seconds: number;
    }> {
        const response = await this.client.get<any>('rate-limit');
        return response.data;
    }

    // ============================================================================
    // Candidate Operations
    // ============================================================================

    /**
     * Get a specific candidate
     */
    async getCandidate(candidateId: number): Promise<any> {
        const response = await this.client.get<any>(`candidates/${candidateId}`);
        return response.data;
    }

    /**
     * Update candidate status
     */
    async updateCandidateStatus(
        candidateId: number,
        status: 'pending' | 'shortlisted' | 'rejected' | 'interviewed' | 'offered' | 'hired'
    ): Promise<{ success: boolean; candidate: any }> {
        const response = await this.client.patch<any>(`candidates/${candidateId}/status`, { status });
        return response.data;
    }

    // ============================================================================
    // Schema Discovery
    // ============================================================================

    /**
     * Get API schema for discovery
     */
    async getSchema(): Promise<any> {
        const response = await this.client.get<any>('schema');
        return response.data;
    }

    // ===========================================================================
    // Calendar Operations
    // ===========================================================================

    /**
     * List calendar connections
     */
    async listCalendarConnections(): Promise<{ success: boolean; data: CalendarConnection[] }> {
        const response = await this.client.get<any>('calendar/connections');
        return response.data;
    }

    /**
     * Create a calendar connection
     */
    async createCalendarConnection(params: CreateCalendarConnectionParams): Promise<{ success: boolean; data: CalendarConnection; message: string }> {
        const response = await this.client.post<any>('calendar/connections', params);
        return response.data;
    }

    /**
     * Delete a calendar connection
     */
    async deleteCalendarConnection(id: number): Promise<{ success: boolean; message: string }> {
        const response = await this.client.delete<any>(`calendar/connections/${id}`);
        return response.data;
    }

    /**
     * Get available slots from calendar
     */
    async getAvailableSlots(params: { provider: string; date: string; duration?: number }): Promise<AvailableSlotsResponse> {
        const response = await this.client.get<any>('calendar/slots', { params });
        return response.data;
    }

    // ===========================================================================
    // Interview Operations
    // ===========================================================================

    /**
     * List interviews
     */
    async listInterviews(jobId?: number): Promise<{ success: boolean; data: Interview[] }> {
        const params = jobId ? { job_id: jobId } : {};
        const response = await this.client.get<any>('interviews', { params });
        return response.data;
    }

    /**
     * Create an interview
     */
    async createInterview(params: CreateInterviewParams): Promise<{ success: boolean; data: Interview; message: string }> {
        const response = await this.client.post<any>('interviews', params);
        return response.data;
    }

    /**
     * Show a specific interview
     */
    async showInterview(id: number): Promise<{ success: boolean; data: Interview }> {
        const response = await this.client.get<any>(`interviews/${id}`);
        return response.data;
    }

    /**
     * Update an interview
     */
    async updateInterview(id: number, params: Partial<CreateInterviewParams>): Promise<{ success: boolean; data: Interview; message: string }> {
        const response = await this.client.put<any>(`interviews/${id}`, params);
        return response.data;
    }

    /**
     * Delete/cancel an interview
     */
    async deleteInterview(id: number): Promise<{ success: boolean; message: string }> {
        const response = await this.client.delete<any>(`interviews/${id}`);
        return response.data;
    }

    // ===========================================================================
    // Meeting Operations
    // ===========================================================================

    /**
     * Generate a meeting link
     */
    async generateMeetingLink(params: { provider: string; topic: string; duration?: number }): Promise<MeetingLinkResponse> {
        const response = await this.client.post<any>('meetings/links', params);
        return response.data;
    }

    // ===========================================================================
    // Credit Operations
    // ===========================================================================

    /**
     * Create a checkout session for credit purchase
     */
    async createCheckoutSession(params: { pack?: string; amount?: number; success_url?: string; cancel_url?: string }): Promise<any> {
        const response = await this.client.post<any>('credits/checkout', params);
        return response.data;
    }

    /**
     * Proxy MCP JSON-RPC requests to the server
     */
    async mcpProxy(payload: any): Promise<any> {
        const response = await this.client.post<any>('mcp', payload);
        return response.data;
    }

    /**
     * Regenerate an agent API key
     */
    async regenerateAgentKey(id: number): Promise<any> {
        const response = await this.client.post<any>(`agent-keys/${id}/regenerate`);
        return response.data;
    }
}

// ===========================================================================
// Factory Functions
// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create API client from config
 */
export function createApiClient(config: Config): ApiClient {
    return new ApiClient(config);
}

/**
 * Create API client from token
 */
export function createApiClientFromToken(token: string, baseUrl?: string): ApiClient {
    return new ApiClient({
        apiToken: token,
        baseUrl: baseUrl || DEFAULT_BASE_URL,
    });
}

// ============================================================================
// Resume Parsing Utilities
// ============================================================================

/**
 * Read resume from file path (async - supports PDF, DOCX, DOC, TXT, MD)
 */
export async function readResumeFromFile(filePath: string): Promise<Resume> {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    
    const stats = fs.statSync(absolutePath);
    
    if (stats.size > MAX_FILE_SIZE) {
        throw new Error(`File too large: ${filePath} (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }
    
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    let content: string;
    
    try {
        if (ext === '.pdf') {
            content = await parsePdf(absolutePath);
        } else if (ext === '.docx') {
            content = await parseDocx(absolutePath);
        } else if (ext === '.doc') {
            content = await parseDoc(absolutePath);
        } else if (['.txt', '.md'].includes(ext)) {
            content = fs.readFileSync(absolutePath, 'utf-8');
        } else {
            throw new Error(`Unsupported file format: ${ext}`);
        }
    } catch (error) {
        throw new Error(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Ensure content is a string
    if (content !== null && typeof content === 'object') {
        content = JSON.stringify(content);
    } else {
        content = String(content || '');
    }
    
    // Validate extracted content
    if (!content || content.trim().length < 50) {
        throw new Error(`Could not extract sufficient text from: ${filePath}`);
    }
    
    return { filename, content };
}

/**
 * Parse PDF file and extract text
 */
async function parsePdf(filePath: string): Promise<string> {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text || '';
    } catch (error) {
        throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Parse DOCX file and extract text
 */
async function parseDocx(filePath: string): Promise<string> {
    try {
        const parser = (officeParser as any).default || officeParser;
        
        // Use a Promise to wrap the callback-based parseOffice method
        // which is the most compatible way across officeparser versions
        return await new Promise<string>((resolve, reject) => {
            try {
                parser.parseOffice(filePath, (data: any, err: any) => {
                    if (err) {
                        reject(new Error(err));
                    } else {
                        resolve(data || '');
                    }
                });
            } catch (err) {
                reject(err);
            }
        });
    } catch (error) {
        throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Parse DOC file and extract text (uses same parser as DOCX)
 */
async function parseDoc(filePath: string): Promise<string> {
    // officeparser supports DOC files as well
    return parseDocx(filePath);
}

/**
 * Read resumes from directory (async)
 */
export async function readResumesFromDirectory(dirPath: string, currentCount: number = 0): Promise<Resume[]> {
    const absolutePath = path.resolve(dirPath);
    
    if (!fs.existsSync(absolutePath)) {
        return [];
    }
    
    const files = fs.readdirSync(absolutePath);
    
    const resumeExtensions = ['.txt', '.pdf', '.doc', '.docx', '.md'];
    const resumes: Resume[] = [];
    
    for (const file of files) {
        if (currentCount + resumes.length >= 100) break;

        const ext = path.extname(file).toLowerCase();
        if (resumeExtensions.includes(ext)) {
            const filePath = path.join(absolutePath, file);
            try {
                resumes.push(await readResumeFromFile(filePath));
            } catch (error) {
                console.warn(`Warning: Could not read ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    }
    
    return resumes;
}

/**
 * Read multiple resume files (async)
 */
export async function readResumesFromPaths(paths: string[]): Promise<Resume[]> {
    const resumes: Resume[] = [];
    
    for (const p of paths) {
        if (resumes.length >= 100) {
            break;
        }
        
        const resolvedPath = path.resolve(p);
        
        // Check if it's a glob pattern
        if (p.includes('*')) {
            const patternMatches = await matchGlobPattern(resolvedPath, resumes.length);
            resumes.push(...patternMatches);
            continue;
        }
        
        try {
            const stat = fs.statSync(resolvedPath);
            
            if (stat.isDirectory()) {
                const dirResumes = await readResumesFromDirectory(resolvedPath, resumes.length);
                resumes.push(...dirResumes);
            } else if (stat.isFile()) {
                resumes.push(await readResumeFromFile(resolvedPath));
            }
        } catch (error) {
            console.warn(`Warning: Could not read ${p}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    if (resumes.length >= 100) {
        console.warn('⚠️ Maximum limit of 100 resumes reached. Additional files in this batch were ignored.');
    }
    
    return resumes.slice(0, 100);
}

/**
 * Match glob patterns for resume files (async)
 */
async function matchGlobPattern(pattern: string, currentCount: number = 0): Promise<Resume[]> {
    const resumes: Resume[] = [];
    const resumeExtensions = ['.txt', '.pdf', '.doc', '.docx', '.md'];

    // Handle **/*.ext patterns (recursive)
    if (pattern.includes('**')) {
        const parts = pattern.split('**');
        const baseDir = path.resolve(parts[0] || '.');
        const suffix = parts[1] || '';
        
        async function walk(dir: string) {
            if (!fs.existsSync(dir)) return;
            if (currentCount + resumes.length >= 100) return;

            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (currentCount + resumes.length >= 100) break;

                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    await walk(fullPath);
                } else if (stat.isFile()) {
                    const ext = path.extname(file).toLowerCase();
                    if (resumeExtensions.includes(ext)) {
                        if (!suffix || fullPath.endsWith(suffix.replace('/', path.sep))) {
                            try {
                                resumes.push(await readResumeFromFile(fullPath));
                            } catch (e) {
                                console.warn(`Warning: Could not read ${file}: ${(e as Error).message}`);
                            }
                        }
                    }
                }
            }
        }
        
        await walk(baseDir);
        return resumes;
    }

    // Standard glob implementation (non-recursive)
    const lastSlash = pattern.lastIndexOf(path.sep);
    let searchDir = '.';
    let filePattern = pattern;

    if (lastSlash >= 0) {
        searchDir = pattern.slice(0, lastSlash);
        filePattern = pattern.slice(lastSlash + 1);
    }

    const searchPath = path.resolve(searchDir);
    if (!fs.existsSync(searchPath)) {
        return resumes;
    }

    const regexPattern = new RegExp('^' + filePattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$', 'i');
    const files = fs.readdirSync(searchPath);

    for (const file of files) {
        if (currentCount + resumes.length >= 100) break;

        if (regexPattern.test(file)) {
            const ext = path.extname(file).toLowerCase();
            if (resumeExtensions.includes(ext)) {
                const filePath = path.join(searchPath, file);
                try {
                    resumes.push(await readResumeFromFile(filePath));
                } catch (e) {
                    console.warn(`Warning: Could not read ${file}: ${(e as Error).message}`);
                }
            }
        }
    }

    return resumes;
}
