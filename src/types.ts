/**
 * HireSquire CLI - TypeScript Type Definitions
 * 
 * Type definitions for API responses, CLI options, and configuration
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface Config {
    apiToken: string;
    baseUrl: string;
    webhookUrl?: string;
    defaultLeniency?: number;
}

export interface ConfigFile {
    apiToken?: string;
    baseUrl?: string;
    webhookUrl?: string;
    defaultLeniency?: number;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface Resume {
    filename: string;
    content: string;
}

export interface CreateJobParams {
    title: string;
    description: string;
    resumes: Resume[];
    leniency_level?: number;
    custom_instructions?: string;
    webhook_url?: string;
    webhook_conditions?: WebhookConditions;
    idempotency_key?: string;
}

export interface WebhookConditions {
    min_score?: number;
    only_top_n?: number;
    events?: string[];
}

export interface EmailParams {
    job_id: number;
    candidate_id: number;
    type: 'invite' | 'rejection' | 'keep-warm' | 'followup';
    custom_message?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface CreateJobResponse {
    job_id: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    status_url: string;
    message?: string;
}

export interface JobStatusResponse {
    job_id: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    message?: string;
    completed_at?: string;
}

export interface Candidate {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    score: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    interview_questions: string[];
    match_explanation: string;
    decision_rationale?: string;
    experience_years?: number;
    education?: string;
    skills?: string[];
}

export interface ResultsResponse {
    job_id: number;
    job_title: string;
    status: 'completed' | 'failed';
    total_candidates: number;
    candidates: Candidate[];
    agent_summary?: string;
    screened_at: string;
}

export interface JobListItem {
    id: number;
    title: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total_candidates: number;
    created_at: string;
    completed_at?: string;
}

export interface JobsListResponse {
    jobs: JobListItem[];
    total: number;
    page: number;
    per_page: number;
}

export interface EmailResponse {
    candidate_id: number;
    email_type: string;
    subject: string;
    body: string;
    generated_at: string;
}

// ============================================================================
// New API Response Types
// ============================================================================

export interface CancelJobResponse {
    job_id: number;
    status: string;
    message: string;
}

export interface CompareResponse {
    job_id: number;
    candidates: Array<{
        id: number;
        name: string;
        score: number;
        summary: string;
    }>;
    comparison: {
        top_candidate: string;
        score_diff: number;
    };
}

export interface OutcomeResponse {
    success: boolean;
    message: string;
}

export interface WebhookTestResponse {
    success: boolean;
    message: string;
    response_code?: number;
}

export interface RateLimitResponse {
    limit: number;
    remaining: number;
    reset_at: string;
    reset_in_seconds: number;
}

export interface CandidateUpdateResponse {
    success: boolean;
    candidate: Candidate;
}

export interface SchemaResponse {
    version: string;
    endpoints: Array<{
        path: string;
        methods: string[];
        description: string;
    }>;
}

// ============================================================================
// CLI Option Types
// ============================================================================

export interface GlobalOptions {
    json: boolean;
    verbose: boolean;
    token?: string;
    config?: string;
}

export interface ScreenOptions extends GlobalOptions {
    job: string;
    resumes: string;
    leniency?: string;
    webhook?: string;
    watch: boolean;
    minScore?: number;
    onlyTopN?: number;
}

export interface JobsOptions extends GlobalOptions {
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    page?: number;
    perPage?: number;
}

export interface ResultsOptions extends GlobalOptions {
    minScore?: number;
    onlyTopN?: number;
}

export interface StatusOptions extends GlobalOptions {
    watch: boolean;
}

export interface EmailOptions extends GlobalOptions {
    candidate: number;
    type: 'invite' | 'rejection' | 'keep-warm' | 'followup';
    customMessage?: string;
}

export interface InitOptions extends GlobalOptions {
    token: string;
    baseUrl?: string;
    webhook?: string;
}

export interface ConfigureOptions extends GlobalOptions {
    token?: string;
    baseUrl?: string;
    webhook?: string;
    leniency?: number;
    clear: boolean;
}

// ============================================================================
// New CLI Command Options
// ============================================================================

export interface CancelOptions extends GlobalOptions {
    job: string;
}

export interface CompareOptions extends GlobalOptions {
    job: string;
    candidates: string;
}

export interface OutcomeOptions extends GlobalOptions {
    job: string;
    candidate: number;
    outcome: 'hired' | 'rejected' | 'withdrawn';
}

export interface WebhookTestOptions extends GlobalOptions {
    url: string;
}

export interface RateLimitOptions extends GlobalOptions {
}

export interface CandidateOptions extends GlobalOptions {
    id: string;
}

export interface CandidateStatusOptions extends GlobalOptions {
    id: string;
    status: 'pending' | 'shortlisted' | 'rejected' | 'interviewed' | 'offered' | 'hired';
}

export interface SchemaOptions extends GlobalOptions {
}

// ============================================================================
// Agent API Key Types
// ============================================================================

export interface AgentApiKey {
    id: number;
    name: string;
    key?: string;
    key_prefix: string;
    is_active: boolean;
    monthly_spend_limit?: number;
    daily_spend_limit?: number;
    lifetime_spend_limit?: number;
    total_spent: number;
    month_spent: number;
    day_spent: number;
    permissions?: string[];
    last_used_at?: string;
    created_at: string;
}

export interface AgentKeyCreateParams {
    name: string;
    monthly_spend_limit?: number;
    daily_spend_limit?: number;
    lifetime_spend_limit?: number;
    permissions?: string[];
}

export interface AgentKeyUsage {
    total_spent: number;
    month_spent: number;
    day_spent: number;
    monthly_spend_limit?: number;
    daily_spend_limit?: number;
    lifetime_spend_limit?: number;
    remaining_monthly?: number;
    remaining_daily?: number;
}

// ============================================================================
// Credit System Types
// ============================================================================

export interface CreditBalance {
    balance: number;
    formatted_balance: string;
    total_purchased: number;
    total_spent: number;
    auto_reload_enabled: boolean;
    auto_reload_threshold?: number;
    auto_reload_amount?: number;
}

export interface CreditTransaction {
    id: number;
    type: 'purchase' | 'usage' | 'refund' | 'bonus';
    amount: number;
    balance_after: number;
    description?: string;
    candidate_count?: number;
    cost_per_candidate?: number;
    created_at: string;
}

export interface CreditPurchaseParams {
    amount: number;
    payment_method_id: string;
}

export interface CreditEstimate {
    candidate_count: number;
    cost_per_candidate: number;
    total_cost: number;
    currency: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class HireSquireError extends Error {
    constructor(
        message: string,
        public code?: string,
        public statusCode?: number
    ) {
        super(message);
        this.name = 'HireSquireError';
    }
}

export class AuthenticationError extends HireSquireError {
    constructor(message: string = 'Authentication failed. Please check your API token.') {
        super(message, 'AUTHENTICATION_ERROR', 401);
        this.name = 'AuthenticationError';
    }
}

export class ValidationError extends HireSquireError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR', 400);
        this.name = 'ValidationError';
    }
}

export class RateLimitError extends HireSquireError {
    constructor(message: string = 'Rate limit exceeded. Please try again later.') {
        super(message, 'RATE_LIMIT_ERROR', 429);
        this.name = 'RateLimitError';
    }
}

export class NotFoundError extends HireSquireError {
    constructor(message: string = 'Resource not found.') {
        super(message, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}

// ============================================================================
// Utility Types
// ============================================================================

export type OutputFormat = 'json' | 'human';

export interface JobPollingOptions {
    interval: number;  // milliseconds
    timeout: number;  // milliseconds
    onProgress?: (status: JobStatusResponse) => void;
}

// ==========================================================================
// Calendar & Meeting Types
// ==========================================================================

export interface CalendarConnection {
    id: number;
    provider: 'calendly' | 'calcom';
    status: 'active' | 'inactive';
    calendar_id?: string;
    created_at: string;
}

export interface CreateCalendarConnectionParams {
    provider: 'calendly' | 'calcom';
    api_key?: string;
    calendar_id?: string;
}

export interface Interview {
    id: number;
    job_posting_id: number;
    candidate_id: number;
    user_id: number;
    scheduled_at: string;
    duration_minutes: number;
    meeting_link?: string;
    calendar_event_id?: string;
    status: 'scheduled' | 'completed' | 'cancelled';
    provider_data?: unknown;
    created_at: string;
    updated_at: string;
}

export interface CreateInterviewParams {
    job_id: number;
    candidate_id: number;
    scheduled_at: string;
    duration_minutes?: number;
    provider?: 'calendly' | 'calcom';
}

export interface MeetingLinkResponse {
    success: boolean;
    data?: {
        link: string;
        provider: string;
    };
    message?: string;
}

export interface AvailableSlotsResponse {
    success: boolean;
    data?: Array<{
        start: string;
        end: string;
    }>;
}
