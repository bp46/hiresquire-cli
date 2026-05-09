#!/usr/bin/env node

/**
 * HireSquire CLI - Main Entry Point
 * 
 * Command-line interface for HireSquire AI-powered candidate screening
 * 
 * Supported agents:
 * - Claude Code / Claude Desktop
 * - OpenCode
 * - OpenClaw
 * - Codex
 * - And any other CLI-capable agent
 * 
 * @packageDocumentation
 * @module HireSquire CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { ApiClient, createApiClient, readResumesFromPaths } from './api';
import { getConfigManager, saveConfig } from './config';
import {
    Config,
    CreateJobParams,
    HireSquireError,
    ValidationError,
} from './types';

// Re-export for external consumers
export { ApiClient, createApiClient, readResumesFromPaths };
export { getConfigManager, saveConfig };
export {
    Config,
    CreateJobParams,
    HireSquireError,
    ValidationError,
    Resume,
    CreateJobResponse,
    JobStatusResponse,
    ResultsResponse,
    Candidate,
    EmailParams,
    EmailResponse,
} from './types';

// For testing purposes
export function createCli() {
    return new Command();
}

// ============================================================================
// Setup
// ============================================================================

const program = new Command();
let apiClient: ApiClient | null = null;
let isJsonOutput = false;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Initialize API client
 */
function initApi(): ApiClient {
    const config = getConfigManager().load();

    if (!config.apiToken) {
        console.error(chalk.red('Error: API token not configured.'));
        console.log(chalk.blue('Run ') + chalk.cyan('hiresquire init') + chalk.blue(' to configure your API token.'));
        process.exit(1);
    }

    return createApiClient(config);
}

/**
 * Output JSON and exit
 * @param data The data to output
 * @param shouldExit Whether to exit the process (default: true)
 */
function outputJson(data: unknown, shouldExit: boolean = true): void {
    console.log(JSON.stringify(data, null, 2));
    if (shouldExit) {
        process.exit(0);
    }
}

/**
 * Handle errors
 */
function handleError(error: unknown, context: string = 'Operation failed'): void {
    if (isJsonOutput) {
        outputJson({
            success: false,
            error: error instanceof Error ? error.message : context,
            context,
        });
    }

    if (error instanceof HireSquireError) {
        console.error(chalk.red(`Error: ${error.message}`));
    } else if (error instanceof ValidationError) {
        console.error(chalk.red(`Validation Error: ${error.message}`));
    } else if (error instanceof Error) {
        console.error(chalk.red(`${context}: ${error.message}`));
    } else {
        console.error(chalk.red(context));
    }

    process.exit(1);
}

/**
 * Output ASCII Logo
 */
function showLogo(): void {
    if (isJsonOutput || !process.stdout.isTTY) return;

    console.log(chalk.hex('#6ee7b7').bold(`
  _   _  _              ____               _                
 | | | |(_) _ __  ___  / ___|  __ _ _   _ (_) _ __  ___    
 | |_| || || '__|/ _ \\ \\___ \\ / _\` | | | || || '__|/ _ \\   
 |  _  || || |  |  __/  ___) | (_| | |_| || || |  |  __/   
 |_| |_||_||_|   \\___| |____/ \\__, |\\__,_||_||_|   \\___|   
                                 |_|                        
    `));
}

/**
 * Confirm action
 */
async function confirm(message: string): Promise<boolean> {
    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message,
            default: false,
        },
    ]);
    return answers.confirm;
}

// ============================================================================
// Commands
// ============================================================================

/**
 * Init command - Configure API token
 */
program
    .command('init')
    .description('Initialize configuration with API token')
    .requiredOption('-t, --token <token>', 'API token from HireSquire dashboard')
    .option('-u, --base-url <url>', 'API base URL', 'https://api.hiresquireai.com/api/v1')
    .option('-w, --webhook <url>', 'Default webhook URL')
    .option('-y, --yes', 'Skip confirmation (auto-enabled for non-interactive/JSON mode)')
    .action(async (options) => {
        try {
            // Auto-skip confirmation for agents using JSON output or CI mode
            const autoYes = isJsonOutput || process.env.CI === 'true';
            if (!options.yes && !autoYes) {
                const confirmed = await confirm(`Save API token to ${getConfigManager().getConfigPath()}?`);
                if (!confirmed) {
                    if (isJsonOutput) {
                        outputJson({ success: false, message: 'Configuration cancelled' });
                    }
                    console.log(chalk.yellow('Configuration cancelled.'));
                    return;
                }
            }

            saveConfig({
                apiToken: options.token,
                baseUrl: options.baseUrl,
                webhookUrl: options.webhook,
            });

            if (isJsonOutput) {
                outputJson({
                    success: true,
                    message: 'Configuration saved successfully',
                    configPath: getConfigManager().getConfigPath(),
                });
                return;
            }

            console.log(chalk.green('✓ Configuration saved successfully'));
            console.log(chalk.gray(`  Config: ${getConfigManager().getConfigPath()}`));
        } catch (error) {
            handleError(error, 'Failed to save configuration');
        }
    });

/**
 * Screen command - Submit screening job
 */
program
    .command('screen')
    .description('Submit a candidate screening job')
    .requiredOption('-t, --title <title>', 'Job posting title')
    .requiredOption('-d, --description <description>', 'Job description (string or @file)')
    .option('-r, --resumes <paths>', 'Resume files or directory (comma-separated or @file)')
    .option('-z, --zip <path>', 'Path to a ZIP file containing resumes (overrides --resumes)')
    .option('-l, --leniency <1-10>', 'Screening leniency level (1=loose, 10=strict)', '5')
    .option('-w, --webhook <url>', 'Webhook URL for notifications')
    .option('--watch', 'Poll for completion and show results')
    .option('--poll-timeout <seconds>', 'Maximum time to poll for completion in seconds', '300')
    .option('--min-score <number>', 'Minimum score threshold for webhook notifications (0-100)')
    .option('--only-top-n <number>', 'Only send top N candidates to webhook')
    .action(async (options) => {
        const spinner = !isJsonOutput ? ora('Submitting screening job...').start() : null;

        try {
            // Validate leniency level
            const leniency = parseInt(options.leniency);
            if (isNaN(leniency) || leniency < 1 || leniency > 10) {
                throw new ValidationError('Leniency level must be an integer between 1 and 10');
            }
            const config = getConfigManager().load();
            const api = initApi();

            // Parse job description
            let jobDescription = options.description;
            if (options.description.startsWith('@')) {
                const fs = require('fs');
                jobDescription = fs.readFileSync(options.description.slice(1), 'utf-8');
            }

            let result;

            // Prepare webhook conditions
            const webhookConditions: Record<string, unknown> = {};
            if (options.minScore) webhookConditions.min_score = parseInt(options.minScore);
            if (options.onlyTopN) webhookConditions.only_top_n = parseInt(options.onlyTopN);

            if (options.zip) {
                const params: Omit<CreateJobParams, 'resumes'> & { zipPath: string } = {
                    title: options.title,
                    description: jobDescription,
                    zipPath: options.zip,
                    leniency_level: parseInt(options.leniency),
                    webhook_url: options.webhook || config.webhookUrl,
                    webhook_conditions: Object.keys(webhookConditions).length > 0
                        ? webhookConditions as CreateJobParams['webhook_conditions']
                        : undefined,
                };

                result = await api.uploadZip(params);
                if (spinner) spinner.succeed(`Job #${result.job_id} created from ZIP archive`);
            } else {
                if (!options.resumes) {
                    throw new ValidationError('You must provide either --resumes or --zip');
                }

                // Parse resumes
                let resumes: { filename: string; content: string }[] = [];

                if (options.resumes.startsWith('@')) {
                    // Read from file (one filename per line)
                    const fs = require('fs');
                    const files = fs.readFileSync(options.resumes.slice(1), 'utf-8')
                        .split('\n')
                        .filter((line: string) => line.trim());
                    resumes = await readResumesFromPaths(files);
                } else {
                    // Comma-separated paths
                    const paths = options.resumes.split(',').map((p: string) => p.trim());
                    resumes = await readResumesFromPaths(paths);
                }

                if (resumes.length === 0) {
                    throw new ValidationError('No resume files found');
                }

                // Create job params
                const params: CreateJobParams = {
                    title: options.title,
                    description: jobDescription,
                    resumes,
                    leniency_level: parseInt(options.leniency),
                    webhook_url: options.webhook || config.webhookUrl,
                    webhook_conditions: Object.keys(webhookConditions).length > 0
                        ? webhookConditions as CreateJobParams['webhook_conditions']
                        : undefined,
                };

                // Submit job
                result = await api.createJob(params);
                if (spinner) spinner.succeed(`Job #${result.job_id} created`);
            }

            if (isJsonOutput) {
                if (options.watch) {
                    // Output intermediate result for watch mode
                    console.log(JSON.stringify({
                        type: 'job_created',
                        job_id: result.job_id,
                        status: result.status,
                    }));
                } else {
                    outputJson({
                        success: true,
                        job_id: result.job_id,
                        status: result.status,
                        status_url: result.status_url,
                    });
                    return;
                }
            }

            console.log(chalk.blue(`  Status: ${chalk.bold(result.status)}`));
            console.log(chalk.gray(`  Poll: ${result.status_url}`));

            // Watch mode
            if (options.watch) {
                const pollOptions: {
                    onProgress?: (status: any) => void;
                    timeout?: number;
                } = {};

                if (!isJsonOutput) {
                    const pollSpinner = ora('Waiting for job completion...').start();
                    pollOptions.onProgress = (status) => {
                        const progress = status.progress || 0;
                        const barWidth = 20;
                        const filled = Math.floor((progress / 100) * barWidth);
                        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
                        pollSpinner.text = `Waiting for job completion... [${bar}] ${progress}% ${status.message || ''}`;
                    };
                }

                // Convert seconds to milliseconds
                if (options.pollTimeout) {
                    pollOptions.timeout = parseInt(options.pollTimeout) * 1000;
                }

                const finalStatus = await api.pollForCompletion(result.job_id, pollOptions);

                if (!isJsonOutput) {
                    console.log(chalk.green(`\n✓ Screening complete!`));
                    console.log(chalk.blue(`  Final status: ${chalk.bold(finalStatus.status)}`));
                }

                if (finalStatus.status === 'completed') {
                    const results = await api.getResults(result.job_id);

                    if (isJsonOutput) {
                        outputJson({
                            type: 'job_completed',
                            success: true,
                            job_id: result.job_id,
                            results,
                        });
                        return;
                    }

                    console.log(chalk.blue(`\n📊 Results (${results.candidates.length} candidates):\n`));

                    // Sort by score
                    const sorted = [...results.candidates].sort((a, b) => b.score - a.score);

                    sorted.forEach((candidate, index) => {
                        const scoreColor = candidate.score >= 80 ? chalk.green :
                            candidate.score >= 60 ? chalk.yellow : chalk.red;
                        console.log(
                            `${chalk.bold(index + 1)}. ${candidate.name} ${scoreColor(`(${candidate.score}/100)`)}`
                        );
                        console.log(chalk.gray(`   ${candidate.summary?.substring(0, 80) || 'No summary'}...`));
                        console.log();
                    });
                }
            }
        } catch (error) {
            if (spinner) spinner.fail('Failed to submit job');
            handleError(error, 'Screening failed');
        }
    });

/**
 * Jobs command - List all jobs
 */
program
    .command('jobs')
    .description('List all screening jobs')
    .option('-s, --status <status>', 'Filter by status (pending, processing, completed, failed)')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-l, --limit <number>', 'Results per page', '10')
    .action(async (options) => {
        try {
            const api = initApi();
            const spinner = ora('Fetching jobs...').start();

            const result = await api.listJobs({
                status: options.status,
                page: parseInt(options.page),
                per_page: parseInt(options.limit),
            });

            spinner.stop();

            if (isJsonOutput) {
                outputJson({
                    success: true,
                    jobs: result.jobs,
                    total: result.total,
                    page: result.page,
                });
                return;
            }

            if (result.jobs.length === 0) {
                console.log(chalk.yellow('No jobs found.'));
                return;
            }

            console.log(chalk.blue(`📋 Jobs (${result.total} total):\n`));

            result.jobs.forEach((job) => {
                const statusColor = job.status === 'completed' ? chalk.green :
                    job.status === 'failed' ? chalk.red :
                        job.status === 'processing' ? chalk.yellow : chalk.gray;

                console.log(`  ${chalk.bold(`#${job.id}`)} ${job.title}`);
                console.log(`     Status: ${statusColor(job.status)} | Candidates: ${job.total_candidates}`);
                console.log(`     Created: ${chalk.gray(new Date(job.created_at).toLocaleString())}`);
                console.log();
            });
        } catch (error) {
            handleError(error, 'Failed to fetch jobs');
        }
    });

/**
 * Results command - Get job results
 */
program
    .command('results')
    .description('Get results for a screening job')
    .requiredOption('-j, --job <id>', 'Job ID')
    .option('--min-score <number>', 'Filter by minimum score')
    .option('--only-top-n <number>', 'Only return top N candidates')
    .action(async (options) => {
        try {
            const api = initApi();
            const spinner = ora('Fetching results...').start();

            const jobId = parseInt(options.job);
            if (isNaN(jobId)) {
                throw new ValidationError('Invalid job ID');
            }

            const result = await api.getResults(jobId, {
                min_score: options.minScore ? parseInt(options.minScore) : undefined,
                only_top_n: options.onlyTopN ? parseInt(options.onlyTopN) : undefined,
            });

            spinner.stop();

            if (isJsonOutput) {
                outputJson({
                    success: true,
                    job_id: result.job_id,
                    job_title: result.job_title,
                    status: result.status,
                    results: {
                        candidates: result.candidates
                    },
                });
                return;
            }

            console.log(chalk.blue(`📊 Results for: ${result.job_title}\n`));
            console.log(chalk.gray(`  Status: ${result.status}`));
            console.log(chalk.gray(`  Screened: ${new Date(result.screened_at).toLocaleString()}`));
            console.log(chalk.gray(`  Total: ${result.total_candidates} candidates\n`));

            // Sort by score
            const sorted = [...result.candidates].sort((a, b) => b.score - a.score);

            sorted.forEach((candidate, index) => {
                const scoreColor = candidate.score >= 80 ? chalk.green :
                    candidate.score >= 60 ? chalk.yellow : chalk.red;
                console.log(
                    `${chalk.bold(index + 1)}. ${candidate.name} ${scoreColor(`(${candidate.score}/100)`)}`
                );
                console.log(chalk.gray(`   ${candidate.summary?.substring(0, 100) || 'No summary'}...`));

                if (candidate.interview_questions?.length > 0) {
                    console.log(chalk.blue(`   Top Interview Question:`));
                    console.log(chalk.gray(`   "${candidate.interview_questions[0]}"`));
                }
                console.log();
            });
        } catch (error) {
            handleError(error, 'Failed to fetch results');
        }
    });

/**
 * Summary command - Get agent-to-human summary
 */
program
    .command('summary')
    .description('Get a human-readable summary of screening results')
    .requiredOption('-j, --job <id>', 'Job ID')
    .action(async (options) => {
        try {
            const api = initApi();
            const jobId = parseInt(options.job);

            if (isNaN(jobId)) {
                throw new ValidationError('Invalid job ID');
            }

            const spinner = ora('Fetching summary...').start();
            const result = await api.getResults(jobId);
            spinner.stop();

            if (isJsonOutput) {
                outputJson({
                    success: true,
                    job_id: result.job_id,
                    summary: result.agent_summary,
                });
                return;
            }

            if (!result.agent_summary) {
                console.log(chalk.yellow('No summary available for this job.'));
                return;
            }

            console.log(chalk.blue(`🛡️  HireSquire Agent Report\n`));
            console.log(result.agent_summary);
            console.log();
        } catch (error) {
            handleError(error, 'Failed to fetch summary');
        }
    });

/**
 * Status command - Check job status
 */
program
    .command('status')
    .description('Check the status of a screening job')
    .requiredOption('-j, --job <id>', 'Job ID')
    .option('-w, --watch', 'Watch for status changes')
    .option('--poll-timeout <seconds>', 'Maximum time to poll for completion in seconds', '300')
    .action(async (options) => {
        try {
            const api = initApi();
            const jobId = parseInt(options.job);

            if (isNaN(jobId)) {
                throw new ValidationError('Invalid job ID');
            }

            if (options.watch) {
                const pollOptions: {
                    onProgress?: (status: any) => void;
                    timeout?: number;
                } = {};

                if (!isJsonOutput) {
                    console.log(chalk.blue('\n⏳ Watching for status changes...\n'));
                    pollOptions.onProgress = (status) => {
                        const progress = status.progress || 0;
                        const barWidth = 20;
                        const filled = Math.floor((progress / 100) * barWidth);
                        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

                        // Use process.stdout.write to update in-place if possible, 
                        // or just log for simplicity in watch mode
                        process.stdout.write(
                            `\r  Status: ${chalk.bold(status.status)} | Progress: [${bar}] ${progress}% ${status.message || ''}`
                        );
                    };
                }

                if (options.pollTimeout) {
                    pollOptions.timeout = parseInt(options.pollTimeout) * 1000;
                }

                const finalStatus = await api.pollForCompletion(jobId, pollOptions);

                if (!isJsonOutput) {
                    console.log(chalk.green(`\n\n✓ Job ${finalStatus.status}!`));
                } else {
                    outputJson({
                        success: true,
                        job_id: finalStatus.job_id,
                        status: finalStatus.status,
                    });
                }
            } else {
                const spinner = ora('Checking status...').start();
                const status = await api.getJobStatus(jobId);
                spinner.stop();

                if (isJsonOutput) {
                    outputJson({
                        success: true,
                        job_id: status.job_id,
                        status: status.status,
                        progress: status.progress,
                    });
                    return;
                }

                const statusColor = status.status === 'completed' ? chalk.green :
                    status.status === 'failed' ? chalk.red :
                        status.status === 'processing' ? chalk.yellow : chalk.gray;

                console.log(chalk.blue(`📋 Job #${jobId}\n`));
                console.log(chalk.gray(`  Status: ${statusColor(status.status)}`));
                if (status.progress !== undefined) {
                    console.log(chalk.gray(`  Progress: ${status.progress}%`));
                }
                if (status.message) {
                    console.log(chalk.gray(`  Message: ${status.message}`));
                }
            }
        } catch (error) {
            handleError(error, 'Failed to check status');
        }
    });

/**
 * Email command - Generate email for candidate
 */
program
    .command('email')
    .description('Generate an email for a candidate')
    .requiredOption('-j, --job <id>', 'Job ID')
    .requiredOption('-c, --candidate <id>', 'Candidate ID')
    .requiredOption('-t, --type <type>', 'Email type (invite, rejection, keep-warm, followup)')
    .option('-m, --message <text>', 'Custom message to include')
    .action(async (options) => {
        try {
            const api = initApi();
            const spinner = ora('Generating email...').start();

            const jobId = parseInt(options.job);
            const candidateId = parseInt(options.candidate);

            if (isNaN(jobId) || isNaN(candidateId)) {
                throw new ValidationError('Invalid job or candidate ID');
            }

            const validTypes = ['invite', 'rejection', 'keep-warm', 'followup'];
            if (!validTypes.includes(options.type)) {
                throw new ValidationError(`Invalid email type. Must be: ${validTypes.join(', ')}`);
            }

            const result = await api.generateEmail({
                job_id: jobId,
                candidate_id: candidateId,
                type: options.type as 'invite' | 'rejection' | 'keep-warm' | 'followup',
                custom_message: options.message,
            });

            spinner.stop();

            if (isJsonOutput) {
                outputJson({
                    success: true,
                    candidate_id: result.candidate_id,
                    email_type: result.email_type,
                    subject: result.subject,
                    body: result.body,
                });
                return;
            }

            console.log(chalk.blue(`📧 Email Generated\n`));
            console.log(chalk.gray(`  Type: ${result.email_type}`));
            console.log(chalk.gray(`  Subject: ${result.subject}\n`));
            console.log(result.body);
        } catch (error) {
            handleError(error, 'Failed to generate email');
        }
    });

/**
 * Configure command - Update configuration
 */
program
    .command('configure')
    .description('Update configuration settings')
    .option('-t, --token <token>', 'API token')
    .option('-u, --base-url <url>', 'API base URL')
    .option('-w, --webhook <url>', 'Default webhook URL')
    .option('-l, --leniency <number>', 'Default leniency level (1-10)')
    .option('-y, --yes', 'Skip confirmation (auto-enabled for non-interactive/JSON mode)')
    .option('--clear', 'Clear configuration')
    .action(async (options) => {
        try {
            if (options.clear) {
                // Auto-skip confirmation for agents using JSON output or CI mode
                const autoYes = isJsonOutput || process.env.CI === 'true';
                if (!options.yes && !autoYes) {
                    const confirmed = await confirm('Clear all configuration?');
                    if (!confirmed) {
                        console.log(chalk.yellow('Configuration cancelled.'));
                        return;
                    }
                }

                getConfigManager().clear();

                if (isJsonOutput) {
                    outputJson({ success: true, message: 'Configuration cleared' });
                    return;
                }

                console.log(chalk.green('✓ Configuration cleared'));
                return;
            }

            const updates: Record<string, unknown> = {};

            if (options.token) updates.apiToken = options.token;
            if (options.baseUrl) updates.baseUrl = options.baseUrl;
            if (options.webhook) updates.webhookUrl = options.webhook;
            if (options.leniency) updates.defaultLeniency = parseInt(options.leniency);

            if (Object.keys(updates).length === 0) {
                // Show current config
            } else {
                saveConfig(updates as Partial<Config>);
            }

            const config = getConfigManager().load();

            if (isJsonOutput) {
                outputJson({
                    success: true,
                    config: {
                        baseUrl: config.baseUrl,
                        webhookUrl: config.webhookUrl,
                        defaultLeniency: config.defaultLeniency,
                    },
                });
                return;
            }

            console.log(chalk.green('✓ Configuration updated'));
            console.log(chalk.gray(`\n  API URL: ${config.baseUrl}`));
            console.log(chalk.gray(`  Webhook: ${config.webhookUrl || '(not set)'}`));
            console.log(chalk.gray(`  Default Leniency: ${config.defaultLeniency}`));
        } catch (error) {
            handleError(error, 'Failed to update configuration');
        }
    });

/**
 * Cancel command - Cancel a running job
 */
program
    .command('cancel')
    .description('Cancel a running screening job')
    .requiredOption('-j, --job <id>', 'Job ID to cancel')
    .action(async (options) => {
        try {
            const api = initApi();
            const jobId = parseInt(options.job);

            if (isNaN(jobId)) {
                throw new ValidationError('Invalid job ID');
            }

            const spinner = !isJsonOutput ? ora('Cancelling job...').start() : null;
            const result = await api.cancelJob(jobId);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result);
                return;
            }

            console.log(chalk.green(`✓ Job #${jobId} cancelled`));
            console.log(chalk.gray(`  Status: ${result.status}`));
            console.log(chalk.gray(`  Message: ${result.message}`));
        } catch (error) {
            handleError(error, 'Failed to cancel job');
        }
    });

/**
 * Compare command - Compare candidates side-by-side
 */
program
    .command('compare')
    .description('Compare multiple candidates side-by-side')
    .requiredOption('-j, --job <id>', 'Job ID')
    .requiredOption('-c, --candidates <ids>', 'Comma-separated candidate IDs')
    .action(async (options) => {
        try {
            const api = initApi();
            const jobId = parseInt(options.job);
            const candidateIds = options.candidates.split(',').map(id => parseInt(id.trim()));

            if (isNaN(jobId)) {
                throw new ValidationError('Invalid job ID');
            }
            if (candidateIds.some(id => isNaN(id))) {
                throw new ValidationError('Invalid candidate ID');
            }

            const spinner = !isJsonOutput ? ora('Comparing candidates...').start() : null;
            const result = await api.compareCandidates(jobId, candidateIds);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result);
                return;
            }

            console.log(chalk.blue(`📊 Comparison (${result.candidates.length} candidates)\n`));
            console.log(chalk.green(`  Top Candidate: ${result.comparison.top_candidate}`));
            console.log(chalk.gray(`  Score Difference: ${result.comparison.score_diff}\n`));

            result.candidates.forEach((cand, idx) => {
                const scoreColor = cand.score >= 80 ? chalk.green : cand.score >= 60 ? chalk.yellow : chalk.red;
                console.log(`${idx + 1}. ${cand.name} ${scoreColor(`(${cand.score})`)}`);
                console.log(chalk.gray(`   ${cand.summary?.substring(0, 80) || 'No summary'}...`));
                console.log();
            });
        } catch (error) {
            handleError(error, 'Failed to compare candidates');
        }
    });

/**
 * Outcome command - Report hiring outcome
 */
program
    .command('outcome')
    .description('Report hiring outcome to improve AI accuracy')
    .requiredOption('-j, --job <id>', 'Job ID')
    .requiredOption('-c, --candidate <id>', 'Candidate ID')
    .requiredOption('-o, --outcome <outcome>', 'Outcome (hired, rejected, withdrawn)')
    .action(async (options) => {
        try {
            const api = initApi();
            const jobId = parseInt(options.job);
            const candidateId = parseInt(options.candidate);
            const validOutcomes = ['hired', 'rejected', 'withdrawn'];

            if (isNaN(jobId) || isNaN(candidateId)) {
                throw new ValidationError('Invalid job or candidate ID');
            }
            if (!validOutcomes.includes(options.outcome)) {
                throw new ValidationError(`Invalid outcome. Must be: ${validOutcomes.join(', ')}`);
            }

            const spinner = !isJsonOutput ? ora('Reporting outcome...').start() : null;
            const result = await api.reportOutcome(jobId, candidateId, options.outcome as any);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result);
                return;
            }

            console.log(chalk.green('✓ Outcome reported'));
            console.log(chalk.gray(`  Message: ${result.message}`));
        } catch (error) {
            handleError(error, 'Failed to report outcome');
        }
    });

/**
 * Webhook-test command - Test a webhook endpoint
 */
program
    .command('webhook-test')
    .description('Test a webhook endpoint')
    .requiredOption('-u, --url <url>', 'Webhook URL to test')
    .action(async (options) => {
        try {
            const api = initApi();
            const spinner = !isJsonOutput ? ora('Testing webhook...').start() : null;
            const result = await api.testWebhook(options.url);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result);
                return;
            }

            if (result.success) {
                console.log(chalk.green('✓ Webhook test successful'));
            } else {
                console.log(chalk.red('✗ Webhook test failed'));
            }
            console.log(chalk.gray(`  Message: ${result.message}`));
            if (result.response_code) {
                console.log(chalk.gray(`  Response Code: ${result.response_code}`));
            }
        } catch (error) {
            handleError(error, 'Failed to test webhook');
        }
    });

/**
 * Rate-limit command - Check rate limit status
 */
program
    .command('rate-limit')
    .description('Check current API rate limit status')
    .action(async (options) => {
        try {
            const api = initApi();
            const spinner = !isJsonOutput ? ora('Checking rate limits...').start() : null;
            const result = await api.getRateLimit();
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result);
                return;
            }

            console.log(chalk.blue('📊 Rate Limit Status\n'));
            console.log(chalk.gray(`  Limit: ${result.limit} requests/minute`));
            console.log(chalk.gray(`  Remaining: ${result.remaining}`));
            console.log(chalk.gray(`  Resets: ${result.reset_at}`));
            console.log(chalk.gray(`  Reset in: ${result.reset_in_seconds} seconds`));
        } catch (error) {
            handleError(error, 'Failed to check rate limit');
        }
    });

/**
 * Candidate command - Get candidate details
 */
program
    .command('candidate')
    .description('Get details of a specific candidate')
    .requiredOption('-i, --id <id>', 'Candidate ID')
    .action(async (options) => {
        try {
            const api = initApi();
            const candidateId = parseInt(options.id);

            if (isNaN(candidateId)) {
                throw new ValidationError('Invalid candidate ID');
            }

            const spinner = !isJsonOutput ? ora('Fetching candidate...').start() : null;
            const result = await api.getCandidate(candidateId);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result);
                return;
            }

            const scoreColor = result.score >= 80 ? chalk.green : result.score >= 60 ? chalk.yellow : chalk.red;
            console.log(chalk.blue(`👤 ${result.name}\n`));
            console.log(chalk.gray(`  Score: ${scoreColor(result.score)}`));
            console.log(chalk.gray(`  Email: ${result.email || 'N/A'}`));
            console.log(chalk.gray(`  Status: ${result.status || 'N/A'}`));
            console.log(chalk.gray(`\n  Summary: ${result.summary?.substring(0, 150) || 'No summary'}...`));
        } catch (error) {
            handleError(error, 'Failed to fetch candidate');
        }
    });

/**
 * Set-status command - Update candidate status
 */
program
    .command('set-status')
    .description('Update a candidate\'s status')
    .requiredOption('-i, --id <id>', 'Candidate ID')
    .requiredOption('-s, --status <status>', 'New status (pending, shortlisted, rejected, interviewed, offered, hired)')
    .action(async (options) => {
        try {
            const api = initApi();
            const candidateId = parseInt(options.id);
            const validStatuses = ['pending', 'shortlisted', 'rejected', 'interviewed', 'offered', 'hired'];

            if (isNaN(candidateId)) {
                throw new ValidationError('Invalid candidate ID');
            }
            if (!validStatuses.includes(options.status)) {
                throw new ValidationError(`Invalid status. Must be: ${validStatuses.join(', ')}`);
            }

            const spinner = !isJsonOutput ? ora('Updating status...').start() : null;
            const result = await api.updateCandidateStatus(candidateId, options.status as any);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result);
                return;
            }

            console.log(chalk.green(`✓ Status updated to ${options.status}`));
        } catch (error) {
            handleError(error, 'Failed to update status');
        }
    });

/**
 * Schema command - Get API schema
 */
program
    .command('schema')
    .description('Get API schema for discovery')
    .action(async (options) => {
        try {
            const api = initApi();
            const spinner = !isJsonOutput ? ora('Fetching schema...').start() : null;
            const result = await api.getSchema();
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result);
                return;
            }

            console.log(chalk.blue(`📖 API Schema v${result.version}\n`));
            result.endpoints.forEach((ep: any) => {
                console.log(`  ${chalk.bold(ep.path)}`);
                console.log(chalk.gray(`    Methods: ${ep.methods.join(', ')}`));
                console.log(chalk.gray(`    ${ep.description}`));
                console.log();
            });
        } catch (error) {
            handleError(error, 'Failed to fetch schema');
        }
    });

/**
 * WhoAmI command - Verify token and get profile info
 */
program
    .command('whoami')
    .alias('profile')
    .description('Verify API token and get profile info')
    .action(async () => {
        try {
            const api = initApi();
            const spinner = !isJsonOutput ? ora('Verifying token...').start() : null;
            const result = await api.get('/schema/validate');
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(result.data);
                return;
            }

            console.log(chalk.blue('👤 Agent Profile\n'));
            console.log(`  Name: ${chalk.bold(result.data.user.name)}`);
            console.log(`  Email: ${result.data.user.email}`);
            console.log(`  Balance: ${chalk.green(result.data.credits.formatted_balance)}`);
            if (result.data.credits.is_low) {
                console.log(chalk.yellow('  ⚠️ Warning: Your credit balance is low.'));
            }
        } catch (error) {
            handleError(error, 'Token verification failed');
        }
    });

/**
 * Agent Keys command - Manage agent API keys
 */
program
    .command('agent-keys')
    .description('Manage agent API keys')
    .option('-a, --action <action>', 'Action: list, create, show, revoke, regenerate, update, usage', 'list')
    .option('-n, --name <name>', 'Key name (for create)')
    .option('-m, --monthly-limit <amount>', 'Monthly spend limit in dollars')
    .option('-d, --daily-limit <amount>', 'Daily spend limit in dollars')
    .option('-l, --lifetime-limit <amount>', 'Lifetime spend limit in dollars')
    .option('-i, --id <id>', 'Key ID (for show/revoke)')
    .option('-p, --permissions <perms>', 'Comma-separated permissions (read,write,screen,email,bulk)')
    .action(async (options) => {
        try {
            const config = getConfigManager().load();

            if (!config.apiToken) {
                throw new Error('API token not configured. Run: hiresquire init -t <token>');
            }

            const api = initApi();

            if (options.action === 'list') {
                const response = await api.get('/agent-keys');
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.blue('📋 Agent API Keys\n'));
                response.data.keys.forEach((key: any) => {
                    console.log(`  ${chalk.bold(key.name)} (${key.key_prefix}...)`);
                    console.log(`    Status: ${key.is_active ? chalk.green('Active') : chalk.red('Inactive')}`);
                    console.log(`    Monthly Spent: $${key.month_spent} / $${key.monthly_spend_limit || '∞'}`);
                    console.log(`    Daily Spent: $${key.day_spent} / $${key.daily_spend_limit || '∞'}`);
                    console.log(`    Total Spent: $${key.total_spent}`);
                    if (key.permissions && key.permissions.length > 0) {
                        console.log(`    Permissions: ${key.permissions.join(', ')}`);
                    }
                    console.log();
                });
            } else if (options.action === 'create') {
                if (!options.name) {
                    throw new Error('Key name required for create. Use: --name "My Agent Key"');
                }
                const perms = options.permissions
                    ? options.permissions.split(',').map(p => p.trim().toLowerCase())
                    : undefined;
                const response = await api.post('/agent-keys', {
                    name: options.name,
                    monthly_spend_limit: options.monthlyLimit ? parseFloat(options.monthlyLimit) : null,
                    daily_spend_limit: options.dailyLimit ? parseFloat(options.dailyLimit) : null,
                    lifetime_spend_limit: options.lifetimeLimit ? parseFloat(options.lifetimeLimit) : null,
                    permissions: perms,
                });
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.green('✓ Agent API key created!'));
                console.log(chalk.yellow('⚠️ Save this key - it will not be shown again:'));
                console.log(chalk.bold(response.data.key.key));
                console.log(chalk.gray(`Key prefix: ${response.data.key.key_prefix}`));
                if (perms) {
                    console.log(chalk.gray(`Permissions: ${perms.join(', ')}`));
                }
            } else if (options.action === 'show') {
                if (!options.id) {
                    throw new Error('Key ID required. Use: --id <key_id>');
                }
                const response = await api.get(`/agent-keys/${options.id}`);
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.blue(`📋 Key: ${response.data.key.name}\n`));
                console.log(`  Prefix: ${response.data.key.key_prefix}`);
                console.log(`  Status: ${response.data.key.is_active ? 'Active' : 'Inactive'}`);
                console.log(`  Total Spent: $${response.data.key.total_spent}`);
                console.log(`  Month Spent: $${response.data.key.month_spent}`);
                console.log(`  Daily Spent: $${response.data.key.day_spent}`);
            } else if (options.action === 'revoke') {
                if (!options.id) {
                    throw new Error('Key ID required. Use: --id <key_id>');
                }
                const response = await api.delete(`/agent-keys/${options.id}`);
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.green('✓ Agent API key revoked'));
            } else if (options.action === 'regenerate') {
                if (!options.id) {
                    throw new Error('Key ID required. Use: --id <key_id>');
                }
                const response = await api.regenerateAgentKey(parseInt(options.id));
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.green('✓ Agent API key regenerated!'));
                console.log(chalk.yellow('⚠️ Save this new key - it will not be shown again:'));
                console.log(chalk.bold(response.data.key.key));
            } else if (options.action === 'update') {
                if (!options.id) {
                    throw new Error('Key ID required. Use: --id <key_id>');
                }
                const response = await api.put(`/agent-keys/${options.id}`, {
                    name: options.name,
                    monthly_spend_limit: options.monthlyLimit ? parseFloat(options.monthlyLimit) : undefined,
                    daily_spend_limit: options.dailyLimit ? parseFloat(options.dailyLimit) : undefined,
                    lifetime_spend_limit: options.lifetimeLimit ? parseFloat(options.lifetimeLimit) : undefined,
                });
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.green('✓ Agent API key updated'));
            } else if (options.action === 'usage') {
                if (!options.id) {
                    throw new Error('Key ID required. Use: --id <key_id>');
                }
                const response = await api.get(`/agent-keys/${options.id}/usage`);
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                const usage = response.data.usage;
                console.log(chalk.blue(`📊 Usage for Key: ${chalk.bold(options.id)}\n`));
                console.log(`  Daily Spent:   ${chalk.green(`$${usage.day_spent.toFixed(2)}`)} / $${usage.daily_spend_limit || '∞'}`);
                console.log(`  Monthly Spent: ${chalk.green(`$${usage.month_spent.toFixed(2)}`)} / $${usage.monthly_spend_limit || '∞'}`);
                console.log(`  Total Spent:   ${chalk.green(`$${usage.total_spent.toFixed(2)}`)} / $${usage.lifetime_spend_limit || '∞'}`);

                if (usage.remaining_daily !== null) {
                    console.log(`  Remaining Daily: ${chalk.cyan(`$${usage.remaining_daily.toFixed(2)}`)}`);
                }
                console.log(chalk.gray(`\n  Billing Month Starts: ${usage.month_start_date}`));
            }
        } catch (error: any) {
            handleError(error, 'Failed to manage agent keys');
        }
    });

/**
 * MCP command - Model Context Protocol bridge
 */
program
    .command('mcp')
    .description('Start MCP server bridge (Model Context Protocol)')
    .action(async () => {
        try {
            const api = initApi();
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                terminal: false
            });

            rl.on('line', async (line: string) => {
                if (!line.trim()) return;

                try {
                    const payload = JSON.parse(line);
                    const response = await api.mcpProxy(payload);
                    process.stdout.write(JSON.stringify(response) + '\n');
                } catch (e) {
                    // Invalid JSON or API error - send JSON-RPC error back if possible
                    const errorResponse = {
                        jsonrpc: '2.0',
                        error: {
                            code: -32700,
                            message: 'Parse error or proxy failure',
                            data: e instanceof Error ? e.message : String(e)
                        },
                        id: null
                    };
                    process.stdout.write(JSON.stringify(errorResponse) + '\n');
                }
            });

            // Handle process signals for graceful exit
            process.on('SIGINT', () => {
                rl.close();
                process.exit(0);
            });

        } catch (error) {
            handleError(error, 'MCP bridge failed to start');
        }
    });

/**
 * Credits command - Manage prepaid credits
 */
program
    .command('credits')
    .description('Manage prepaid credits')
    .option('-a, --action <action>', 'Action: balance, purchase, transactions, checkout, list-packs, auto-reload-enable, auto-reload-disable', 'balance')
    .option('-m, --amount <amount>', 'Amount to purchase in dollars (min $5)')
    .option('-p, --pack <pack>', 'Credit pack to purchase: pouch, satchel, chest')
    .option('-l, --limit <number>', 'Number of transactions to show')
    .option('--threshold <number>', 'Auto-reload threshold in dollars')
    .option('--payment-method-id <id>', 'Stripe payment method ID')
    .action(async (options) => {
        try {
            const config = getConfigManager().load();

            if (!config.apiToken) {
                throw new Error('API token not configured. Run: hiresquire init -t <token>');
            }

            const api = initApi();

            if (options.action === 'balance') {
                const response = await api.get('/credits/balance');
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.blue('💳 Credit Balance\n'));
                console.log(`  Balance: ${chalk.bold(response.data.formatted_balance)}`);
                console.log(`  Total Purchased: $${response.data.total_purchased}`);
                console.log(`  Total Spent: $${response.data.total_spent}`);
                console.log(`  Auto-reload: ${response.data.auto_reload_enabled ? chalk.green('Enabled') : chalk.gray('Disabled')}`);
            } else if (options.action === 'list-packs') {
                const response = await api.get('/credits/packs');
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.blue('📦 Credit Packs\n'));
                response.data.packs.forEach((pack: any) => {
                    console.log(`  ${chalk.bold(pack.id)}: $${pack.price} for ${pack.credits} credits${pack.bonus > 0 ? ` + ${pack.bonus} bonus` : ''}`);
                });
            } else if (options.action === 'checkout') {
                const requestData: any = {};

                if (options.pack) {
                    requestData.pack = options.pack;
                } else if (options.amount) {
                    requestData.amount = parseFloat(options.amount);
                } else {
                    // Default to pouch if nothing specified
                    requestData.pack = 'pouch';
                }

                const response = await api.createCheckoutSession(requestData);

                if (isJsonOutput) {
                    outputJson({
                        success: true,
                        checkout_url: response.checkout_url,
                        amount: response.amount,
                        expires_at: response.expires_at,
                    });
                    return;
                }

                console.log(chalk.blue('🔗 Checkout Session Created\n'));
                if (response.pack) {
                    console.log(`  Pack: ${chalk.bold(response.pack.name)} ($${response.pack.price})`);
                } else {
                    console.log(`  Amount: ${chalk.bold(`$${response.amount}`)}`);
                }
                console.log(chalk.cyan(`\n  Payment Link: ${response.checkout_url}`));
                console.log(chalk.gray('\n  Share this link with your manager or open it to complete payment.'));
                console.log(chalk.gray(`  Link expires at: ${new Date(response.expires_at).toLocaleString()}`));
            } else if (options.action === 'transactions') {
                const response = await api.get('/credits/transactions', {
                    params: { limit: options.limit || 20 }
                });
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.blue('📜 Credit Transactions\n'));
                response.data.transactions.forEach((tx: any) => {
                    const sign = tx.amount >= 0 ? '+' : '';
                    console.log(`  ${sign}$${tx.amount} - ${tx.description || tx.type}`);
                    console.log(chalk.gray(`    Balance: $${tx.balance_after} | ${tx.created_at}`));
                });
            } else if (options.action === 'auto-reload-enable') {
                if (!options.threshold || !options.amount || !options.paymentMethodId) {
                    throw new Error('Auto-reload requires --threshold, --amount, and --payment-method-id');
                }
                const response = await api.post('/credits/auto-reload/enable', {
                    threshold: parseFloat(options.threshold),
                    amount: parseFloat(options.amount),
                    payment_method_id: options.paymentMethodId
                });
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.green('✓ Auto-reload enabled'));
                console.log(chalk.gray(`  Threshold: $${response.data.auto_reload.threshold}`));
                console.log(chalk.gray(`  Amount: $${response.data.auto_reload.amount} per reload`));
            } else if (options.action === 'auto-reload-disable') {
                const response = await api.post('/credits/auto-reload/disable');
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.green('✓ Auto-reload disabled'));
            } else if (options.action === 'purchase') {
                if (!options.paymentMethodId) {
                    throw new Error('Direct purchase requires --payment-method-id');
                }

                const requestData: any = {
                    payment_method_id: options.paymentMethodId
                };

                if (options.pack) {
                    requestData.pack = options.pack;
                } else if (options.amount) {
                    requestData.amount = parseFloat(options.amount);
                } else {
                    throw new Error('Purchase requires either --pack or --amount');
                }

                const response = await api.post('/credits/purchase', requestData);
                if (isJsonOutput) {
                    outputJson(response.data);
                    return;
                }
                console.log(chalk.green('✓ Purchase successful'));
                console.log(chalk.gray(`  New balance: ${response.data.balance}`));
            }
        } catch (error: any) {
            handleError(error, 'Failed to manage credits');
        }
    });

// ============================================================================
// Calendar Commands
// ============================================================================

/**
 * Calendar:connect command - Connect a calendar provider
 */
program
    .command('calendar:connect <provider>')
    .description('Connect a calendar provider (calendly, calcom)')
    .option('-t, --token <token>', 'API token/key for calendly/calcom')
    .option('--api-key <token>', 'API key for the provider (alias for --token)')
    .option('-c, --calendar-id <id>', 'Calendar ID (optional)')
    .action(async (provider, options) => {
        try {
            const config = getConfigManager().load();
            if (!config.apiToken) {
                throw new Error('API token not configured. Run: hiresquire init -t <token>');
            }

            const api = initApi();
            const params: any = { provider };

            if (options.token || options.apiKey) params.api_key = options.token || options.apiKey;
            if (options.calendarId) params.calendar_id = options.calendarId;

            const spinner = !isJsonOutput ? ora('Connecting calendar...').start() : null;
            const response = await api.createCalendarConnection(params);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(response);
                return;
            }

            console.log(chalk.green('✓ Calendar connection created'));
            console.log(`  Provider: ${chalk.bold(response.data.provider)}`);
        } catch (error: any) {
            handleError(error, 'Failed to connect calendar');
        }
    });

/**
 * Calendar:list command - List calendar connections
 */
program
    .command('calendar:list')
    .description('List calendar connections')
    .action(async () => {
        try {
            const config = getConfigManager().load();
            if (!config.apiToken) {
                throw new Error('API token not configured. Run: hiresquire init -t <token>');
            }

            const api = initApi();
            const response = await api.listCalendarConnections();

            if (isJsonOutput) {
                outputJson(response);
                return;
            }

            console.log(chalk.blue('📅 Calendar Connections\n'));
            response.data.forEach((conn: any) => {
                console.log(`  ${chalk.bold(conn.provider)} - ${conn.status}`);
            });
        } catch (error: any) {
            handleError(error, 'Failed to list calendar connections');
        }
    });

// ============================================================================
// Interview Commands
// ============================================================================

/**
 * Interviews:schedule command - Schedule an interview
 */
program
    .command('interviews:schedule')
    .description('Schedule an interview')
    .requiredOption('-j, --job <id>', 'Job ID')
    .requiredOption('-c, --candidate <id>', 'Candidate ID')
    .requiredOption('-t, --time <datetime>', 'Scheduled time (ISO 8601)')
    .option('-d, --duration <minutes>', 'Duration in minutes', '60')
    .option('-p, --provider <provider>', 'Calendar provider (calendly, calcom)')
    .action(async (options) => {
        try {
            const config = getConfigManager().load();
            if (!config.apiToken) {
                throw new Error('API token not configured. Run: hiresquire init -t <token>');
            }

            const api = initApi();
            const params: any = {
                job_id: parseInt(options.job),
                candidate_id: parseInt(options.candidate),
                scheduled_at: options.time,
                duration_minutes: parseInt(options.duration),
            };

            if (options.provider) params.provider = options.provider;

            const response = await api.createInterview(params);

            if (isJsonOutput) {
                outputJson(response);
                return;
            }

            console.log(chalk.green('✓ Interview scheduled'));
            console.log(`  Interview ID: ${chalk.bold(response.data.id)}`);
            if (response.data.meeting_link) {
                console.log(`  Meeting Link: ${chalk.cyan(response.data.meeting_link)}`);
            }
        } catch (error: any) {
            handleError(error, 'Failed to schedule interview');
        }
    });

/**
 * Interviews:list command - List interviews
 */
program
    .command('interviews:list')
    .description('List interviews')
    .option('-j, --job <id>', 'Filter by job ID')
    .action(async (options) => {
        try {
            const config = getConfigManager().load();
            if (!config.apiToken) {
                throw new Error('API token not configured. Run: hiresquire init -t <token>');
            }

            const api = initApi();
            const params: any = {};
            if (options.job) params.job_id = parseInt(options.job);

            const spinner = !isJsonOutput ? ora('Fetching interviews...').start() : null;
            const response = await api.listInterviews(params.job_id);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(response);
                return;
            }

            console.log(chalk.blue('📅 Interviews\n'));
            response.data.forEach((interview: any) => {
                console.log(`  ID: ${interview.id} | Job: ${interview.job_posting_id} | Candidate: ${interview.candidate_id}`);
                console.log(`    Scheduled: ${interview.scheduled_at} | Status: ${interview.status}`);
                if (interview.meeting_link) {
                    console.log(`    Link: ${interview.meeting_link}`);
                }
            });
        } catch (error: any) {
            handleError(error, 'Failed to list interviews');
        }
    });

// ============================================================================
// Meeting Commands
// ============================================================================

/**
 * Meetings:link command - Generate a meeting link
 */
program
    .command('meetings:link')
    .description('Generate a meeting link')
    .requiredOption('-p, --provider <provider>', 'Calendar provider (calendly, calcom)')
    .requiredOption('-t, --topic <topic>', 'Meeting topic')
    .option('-d, --duration <minutes>', 'Duration in minutes', '60')
    .action(async (options) => {
        try {
            const config = getConfigManager().load();
            if (!config.apiToken) {
                throw new Error('API token not configured. Run: hiresquire init -t <token>');
            }

            const api = initApi();
            const params = {
                provider: options.provider,
                topic: options.topic,
                duration: parseInt(options.duration),
            };

            const spinner = !isJsonOutput ? ora('Generating meeting link...').start() : null;
            const response = await api.generateMeetingLink(params);
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(response);
                return;
            }

            console.log(chalk.green('✓ Meeting link generated'));
            if (response.data) {
                console.log(`  Link: ${chalk.cyan(response.data.link)}`);
                console.log(`  Provider: ${response.data.provider}`);
            }
        } catch (error: any) {
            handleError(error, 'Failed to generate meeting link');
        }
    });

/**
 * Estimate command - Estimate screening cost
 */
program
    .command('estimate')
    .description('Estimate screening cost')
    .option('-c, --candidates <number>', 'Number of candidates', '10')
    .action(async (options) => {
        try {
            const config = getConfigManager().load();

            if (!config.apiToken) {
                throw new Error('API token not configured. Run: hiresquire init -t <token>');
            }

            const api = initApi();
            const spinner = !isJsonOutput ? ora('Estimating cost...').start() : null;
            const response = await api.get('/credits/estimate', {
                params: { candidate_count: parseInt(options.candidates) }
            });
            if (spinner) spinner.stop();

            if (isJsonOutput) {
                outputJson(response.data);
                return;
            }
            console.log(chalk.blue('💰 Cost Estimate\n'));
            console.log(`  Candidates: ${response.data.candidate_count}`);
            console.log(`  Cost per candidate: $${response.data.cost_per_candidate}`);
            console.log(chalk.bold(`  Total: $${response.data.total_cost}`));
        } catch (error: any) {
            handleError(error, 'Failed to estimate cost');
        }
    });

// ============================================================================
// Global Options
// ============================================================================

program
    .option('--json', 'Output as JSON')
    .option('-v, --verbose', 'Enable verbose logging')
    .version('1.2.2');

// ============================================================================
// Parse & Execute
// ============================================================================

// Check for JSON flag in argv (before command runs)
if (process.argv.includes('--json')) {
    isJsonOutput = true;
}

// Show logo for interactive terminal users (unless JSON requested)
showLogo();

// Show help if no command provided
const commandArgs = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
if (commandArgs.length === 0) {
    if (isJsonOutput) {
        outputJson({
            success: false,
            error: "No command provided",
            commands: program.commands.map(cmd => cmd.name())
        });
        process.exit(1);
    } else {
        program.help();
    }
}

program.parse(process.argv);
