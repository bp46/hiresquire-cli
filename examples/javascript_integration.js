/**
 * HireSquire CLI - JavaScript Integration Example
 * 
 * This example demonstrates how to integrate the HireSquire CLI into a Node.js 
 * application or agent using child_process. This is the recommended pattern 
 * for agents that can execute arbitrary JavaScript but don't want to manage 
 * heavy SDK dependencies.
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Screen candidates using HireSquire CLI via npx
 * 
 * @param {string} title - Job title
 * @param {string} description - Job description
 * @param {string} resumesPath - Path to resumes directory or file
 * @returns {Promise<Object>} - The screening result
 */
async function screenCandidates(title, description, resumesPath) {
    console.log(`🚀 Starting screening for: ${title}`);
    
    try {
        // We use the --json flag to get machine-readable output
        // We use npx to ensure the CLI is available without global installation
        const { stdout, stderr } = await execPromise(`npx -y hiresquire-cli screen \
            --title "${title}" \
            --description "${description}" \
            --resumes "${resumesPath}" \
            --json \
            --watch`);

        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        // The output will contain multiple JSON objects if --watch is used
        // The last one is the final result
        const parts = stdout.trim().split('\n');
        const finalResult = JSON.parse(parts[parts.length - 1]);
        
        return finalResult;
    } catch (error) {
        console.error('❌ Screening failed:', error.message);
        throw error;
    }
}

/**
 * Main execution
 */
async function main() {
    const jobTitle = "Senior Full Stack Engineer";
    const jobDescription = "We need a developer with 5+ years of experience in React, Node.js, and PostgreSQL.";
    const resumesPath = "./resumes/"; // Ensure this directory exists with some PDF/TXT files

    console.log("--- HireSquire Agentic Workflow ---");
    
    try {
        const result = await screenCandidates(jobTitle, jobDescription, resumesPath);
        
        if (result.type === 'job_completed' && result.success) {
            console.log(`✅ Screening Complete! Job ID: ${result.job_id}`);
            console.log(`📊 Found ${result.results.candidates.length} candidates.`);
            
            // Sort and display top 3
            const topCandidates = result.results.candidates
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);
            
            console.log("\nTop Candidates:");
            topCandidates.forEach((c, i) => {
                console.log(`${i + 1}. ${c.name} - Score: ${c.score}/100`);
                console.log(`   Summary: ${c.summary.substring(0, 100)}...`);
            });
        }
    } catch (err) {
        // Error handling is handled in screenCandidates
    }
}

// Run the example
if (require.main === module) {
    main();
}
