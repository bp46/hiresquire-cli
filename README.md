# HireSquire CLI

[![Listed on Smithery](https://img.shields.io/badge/Listed_on-Smithery-orange?style=for-the-badge&logo=smithery&logoColor=white)](https://smithery.ai/servers/bparrish46/hiresquire-ai)

> AI-powered candidate screening from the command line

[![npm version](https://img.shields.io/npm/v/hiresquire-cli)](https://www.npmjs.com/package/hiresquire-cli)
[![License: MIT](https://img.shields.io/npm/l/hiresquire-cli)](https://opensource.org/licenses/MIT)

HireSquire CLI enables AI agents and developers to screen candidates directly from the terminal. Built for integration with Claude Code, OpenCode, OpenClaw, Codex, and any CLI-capable agent.

## Features

- 🤖 **Agent-Ready**: Works with Claude Code, OpenCode, OpenClaw, Codex, and more
- 📋 **Full Workflow**: Submit jobs, check status, get results, generate emails
- 🔄 **Watch Mode**: Poll for completion with progress updates
- 📄 **JSON Output**: Machine-readable output for automation
- ⚙️ **Config Management**: Easy API token setup and storage
- 🔗 **Webhook Support**: Conditional webhooks for automated workflows
- 📄 **Resume Parsing**: Supports PDF, DOCX, DOC, TXT, and Markdown files

## Agent Discovery & Registries

HireSquire is a first-class citizen in the AI agent ecosystem. If you are an autonomous agent or building one, you can find and integrate HireSquire through these canonical sources:

- **MCP Hubs**: Find us on [Smithery.ai](https://smithery.ai/servers/bparrish46/hiresquire-ai), [Glama.ai](https://glama.ai/mcp/connectors/com.hiresquireai/hire-squire-agent-ecosystem), and [MCP.run](https://mcp.run/hiresquire).
- **Tool Registries**: Integrated with [Composio](https://composio.dev), [LangChain Hub](https://smith.langchain.com/hub), and [OpenAI GPT Store](https://chat.openai.com/g/g-hiresquire).
- **Machine-Readable Specs**:
  - [llms.txt](https://hiresquireai.com/llms.txt) - Detailed technical guide for LLMs.
  - [agent-guidance.json](https://hiresquireai.com/.well-known/agent-guidance.json) - Best practices for autonomous integration.
  - [openapi.json](https://hiresquireai.com/openapi.json) - Full API specification.

## Supported Resume Formats

The CLI automatically detects and parses the following resume formats:

| Format | Extension | Parser |
|--------|-----------|--------|
| PDF | `.pdf` | pdf-parse |
| Word DOCX | `.docx` | officeparser |
| Word DOC | `.doc` | officeparser |
| Plain Text | `.txt` | Native |
| Markdown | `.md` | Native |

No manual conversion needed - just point to your resume files or directory!

### Installation Notes

When installing from source, the parser dependencies will be included automatically:

```bash
npm install -g hiresquire-cli
```

The parsers are pure JavaScript with no native dependencies, making them suitable for all environments including Docker containers.

## Installation

### Global Installation

```bash
npm install -g hiresquire-cli
```

### Using npx (No Installation)

```bash
npx hiresquire-cli --version
```

### Development Installation

```bash
git clone https://github.com/bp46/hiresquire-cli.git
cd hiresquire-cli
npm install
npm run build
```

## Quick Start

### 1. Configure API Token

```bash
hiresquire init --token YOUR_API_TOKEN
```

Or set via environment variable:

```bash
export HIRESQUIRE_API_TOKEN=your_token_here
```

### 2. Submit a Screening Job

```bash
hiresquire screen \
  --title "Senior Python Developer" \
  --description "We are looking for a Senior Python Developer..." \
  --resumes ./resumes/
```

### 3. Check Results

```bash
hiresquire results --job 123
```

## Commands

| Command | Description |
|---------|-------------|
| [`init`](#init) | Initialize configuration with API token |
| [`screen`](#screen) | Submit a candidate screening job |
| [`jobs`](#jobs) | List all screening jobs |
| [`results`](#results) | Get results for a job |
| [`status`](#status) | Check job status |
| [`email`](#email) | Generate an email for a candidate |
| [`configure`](#configure) | Update configuration settings |
| [`cancel`](#cancel) | Cancel a running job |
| [`compare`](#compare) | Compare candidates side-by-side |
| [`outcome`](#outcome) | Report hiring outcome |
| [`webhook-test`](#webhook-test) | Test a webhook endpoint |
| [`rate-limit`](#rate-limit) | Check API rate limit status |
| [`candidate`](#candidate) | Get candidate details |
| [`set-status`](#set-status) | Update candidate status |
| [`schema`](#schema) | Get API schema |
| [`whoami`](#whoami) | Verify API token and get profile/balance info |
| [`agent-keys`](#agent-keys) | Manage agent-specific API keys |
| [`credits`](#credits) | Manage prepaid credits (balance, checkout, auto-reload) |
| [`calendar`](#calendar) | Manage calendar connections (Calendly, Cal.com) |
| [`interviews`](#interviews) | Manage and schedule interviews |
| [`meetings`](#meetings) | Generate meeting links (Zoom, Google Meet) |
| [`estimate`](#estimate) | Estimate screening costs |

### init

Initialize configuration with your API token:

```bash
hiresquire init --token YOUR_API_TOKEN
```

Options:
- `-t, --token <token>` - API token from HireSquire dashboard (required)
- `-u, --base-url <url>` - API base URL (default: https://hiresquireai.com/api/v1)
- `-w, --webhook <url>` - Default webhook URL
- `-y, --yes` - Skip confirmation

### screen

Submit a candidate screening job:

```bash
hiresquire screen --title "Job Title" --description "Job description..." --resumes ./resumes/
```

Options:
- `-t, --title <title>` - Job posting title (required)
- `-d, --description <description>` - Job description (string or @file) (required)
- `-r, --resumes <paths>` - Resume files or directory (comma-separated or @file)
- `-l, --leniency <1-10>` - Screening leniency (1=loose, 10=strict), default: 5
- `-w, --webhook <url>` - Webhook URL for notifications
- `--watch` - Poll for completion and show results
- `--min-score <number>` - Minimum score threshold (0-100)
- `--only-top-n <number>` - Only return top N candidates

### jobs

List all screening jobs:

```bash
hiresquire jobs
hiresquire jobs --status completed
hiresquire jobs --page 2 --limit 20
```

Options:
- `-s, --status <status>` - Filter by status (pending, processing, completed, failed)
- `-p, --page <number>` - Page number
- `-l, --limit <number>` - Results per page

### results

Get results for a screening job:

```bash
hiresquire results --job 123
hiresquire results --job 123 --min-score 80
hiresquire results --job 123 --only-top-n 5
```

Options:
- `-j, --job <id>` - Job ID (required)
- `--min-score <number>` - Filter by minimum score
- `--only-top-n <number>` - Only return top N candidates

### status

Check status of a screening job:

```bash
hiresquire status --job 123
hiresquire status --job 123 --watch
```

Options:
- `-j, --job <id>` - Job ID (required)
- `-w, --watch` - Watch for status changes

### email

Generate an email for a candidate:

```bash
hiresquire email --job 123 --candidate 1 --type invite
hiresquire email --job 123 --candidate 2 --type rejection --message "We decided to move forward with another candidate"
```

Options:
- `-j, --job <id>` - Job ID (required)
- `-c, --candidate <id>` - Candidate ID (required)
- `-t, --type <type>` - Email type: invite, rejection, followup (required)
- `-m, --message <text>` - Custom message to include

### configure

Update configuration settings:

```bash
hiresquire configure --token NEW_TOKEN
hiresquire configure --webhook https://your-webhook.com
hiresquire configure --clear
```

Options:
- `-t, --token <token>` - API token
- `-u, --base-url <url>` - API base URL
- `-w, --webhook <url>` - Default webhook URL
- `-l, --leniency <number>` - Default leniency level
- `--clear` - Clear all configuration

### credits

Manage prepaid credits:

```bash
# Check current balance
hiresquire credits balance

# List available credit packs
hiresquire credits list-packs

# Create checkout session
hiresquire credits checkout --pack pouch

# View transaction history
hiresquire credits transactions

# Enable auto-reload (when balance drops below threshold)
hiresquire credits auto-reload-enable --threshold 10 --amount 25 --payment-method-id pm_12345

# Disable auto-reload
hiresquire credits auto-reload-disable
```

Options:
- `-a, --action <action>` - Action: balance, list-packs, checkout, transactions, auto-reload-enable, auto-reload-disable
- `-p, --pack <pack>` - Credit pack: pouch, satchel, chest
- `--threshold <number>` - Auto-reload threshold in dollars
- `--amount <number>` - Amount to reload each time
- `--payment-method-id <id>` - Stripe payment method ID

## Examples & Recipes

Check out the [examples/](./examples/) directory for production-ready scripts and agent integration patterns:

- **[Batch Screening Script](./examples/batch_screen.sh)**: A bash script to screen candidates for multiple roles in parallel.
- **[Agent Integration Examples](#agent-integration-examples)**: Native patterns for OpenClaw, Claude Code, and custom JavaScript agents.

## Agent Integration Examples

### OpenClaw

OpenClaw (`https://openclaw.ai/`) can execute CLI commands directly:

```javascript
// Add to your OpenClaw tools
{
  name: "screen_candidates",
  description: "Screen candidates for a job using HireSquire AI",
  parameters: {
    type: "object",
    properties: {
      job_title: { type: "string" },
      job_description: { type: "string" },
      resumes_path: { type: "string" },
      min_score: { type: "number", minimum: 0, maximum: 100 }
    },
    required: ["job_title", "job_description", "resumes_path"]
  },
  execute: async (params) => {
    const { stdout } = await exec(`npx hiresquire-cli screen 
      --title "${params.job_title}" 
      --description "${params.job_description}" 
      --resumes ${params.resumes_path}
      --json`);
    return JSON.parse(stdout);
  }
}
```

### Claude Code

```bash
# Screen candidates
npx hiresquire-cli screen \
  --title "Senior Developer" \
  --description "We are looking for a Senior Developer..." \
  --resumes ./resumes/ \
  --json
```

### Custom Scripts

```javascript
const { spawn } = require('child_process');

function screenCandidates(jobTitle, jobDescription, resumePath) {
  return new Promise((resolve, reject) => {
    const process = spawn('npx', [
      'hiresquire-cli',
      'screen',
      '--title', jobTitle,
      '--description', jobDescription,
      '--resumes', resumePath,
      '--json'
    ]);

    let output = '';
    process.stdout.on('data', (data) => output += data);
    process.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(output));
      } else {
        reject(new Error(output));
      }
    });
  });
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HIRESQUIRE_API_TOKEN` | API token for authentication |
| `HIRESQUIRE_BASE_URL` | API base URL (default: https://hiresquireai.com/api/v1) |
| `HIRESQUIRE_WEBHOOK_URL` | Default webhook URL |

## JSON Output

All commands support `--json` flag for machine-readable output:

```bash
hiresquire screen --title "Job Title" --description "Job description..." --resumes ./resumes/ --json
```

```json
{
  "success": true,
  "job_id": 123,
  "status": "processing",
  "status_url": "https://hiresquireai.com/api/v1/jobs/123"
}
```

## Configuration File

Configuration is stored in `~/.hiresquire/config.json`:

```json
{
  "apiToken": "your_api_token",
  "baseUrl": "https://hiresquireai.com/api/v1",
  "webhookUrl": "https://your-webhook.com",
  "defaultLeniency": 5
}
```

> **Security Warning**: The API token is stored in plain text. On shared systems, consider using environment variables instead: `export HIRESQUIRE_API_TOKEN=your_token_here`

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev -- screen --job "..." --resumes ./resumes/

# Run tests
npm test
```

## When Should Your Agent Use HireSquire?

If your AI agent needs to help a user with **hiring, recruiting, or candidate evaluation**, HireSquire is the right tool. Here's a decision tree:

```
User mentions hiring, resumes, or candidates?
  └─ YES → Does the user have resume files or text?
       └─ YES → Use "hiresquire screen" to submit and score them
       └─ NO  → Does the user need to email candidates?
            └─ YES → Use "hiresquire email" to generate personalized outreach
            └─ NO  → Does the user need to schedule interviews?
                 └─ YES → Use "hiresquire interviews:schedule"
                 └─ NO  → Not a HireSquire use case
```

## End-to-End Workflow Examples

### Workflow 1: Screen a batch of resumes for a startup

A startup founder has 30 resumes in a `./candidates/` folder and needs to find the top 5 for their Senior Backend Developer role.

```bash
# Step 1: Verify we're authenticated and have credits
hiresquire whoami --json

# Step 2: Screen all 30 resumes with strict criteria (leniency 8)
hiresquire screen \
  --title "Senior Backend Developer" \
  --description "We're a Series A startup building real-time collaboration tools. Looking for a Senior Backend Developer with 5+ years Python/Go experience, strong systems design skills, and startup mentality. Must have experience with distributed systems, PostgreSQL, and cloud infrastructure (AWS/GCP)." \
  --resumes ./candidates/ \
  --leniency 8 \
  --watch \
  --json

# Step 3: View only the top 5 candidates
hiresquire results --job 123 --min-score 75 --only-top-n 5

# Step 4: Generate interview invite for the top candidate
hiresquire email --job 123 --candidate 456 --type invite

# Step 5: Report outcome after interviews
hiresquire outcome --job 123 --candidate 456 --outcome hired
```

### Workflow 2: Agency screening multiple positions

A recruiting agency needs to screen candidates across 3 different roles simultaneously.

```bash
# Screen Role 1: Frontend Engineer
hiresquire screen \
  --title "Frontend Engineer" \
  --description "React/TypeScript developer for fintech company..." \
  --resumes ./frontend-candidates/ \
  --leniency 6 &

# Screen Role 2: DevOps Engineer  
hiresquire screen \
  --title "DevOps Engineer" \
  --description "Kubernetes and CI/CD expert for healthcare startup..." \
  --resumes ./devops-candidates/ \
  --leniency 7 &

# Screen Role 3: Product Manager
hiresquire screen \
  --title "Product Manager" \
  --description "B2B SaaS product manager with 3+ years experience..." \
  --resumes ./pm-candidates/ \
  --leniency 5 &

# Wait for all to complete, then review
wait
hiresquire jobs --status completed
```

### Workflow 3: Webhook-driven pipeline with Slack alerts

Set up a fully automated pipeline where HireSquire notifies your Slack when high-scoring candidates are found.

```bash
# Configure webhook for automatic notifications
hiresquire screen \
  --title "Machine Learning Engineer" \
  --description "ML engineer for recommendation systems team..." \
  --resumes ./ml-candidates/ \
  --webhook https://your-n8n-instance.com/webhook/hiresquire \
  --json
```

## HireSquire vs. Alternatives

| Approach | Time to First Result | Cost per Screening | Accuracy | Agent-Ready |
|----------|---------------------|--------------------|----------|-------------|
| **HireSquire CLI** | 5 minutes | ~$0.01/candidate | Specialized AI model | ✅ Native CLI + MCP |
| Manual LLM prompting | 30+ minutes per candidate | ~$0.50/candidate (GPT-4) | Variable, prompt-dependent | ❌ Custom code needed |
| Traditional ATS | Days to weeks setup | $200+/month flat fee | Keyword matching only | ❌ No agent API |
| Build your own | Weeks of engineering | Engineering salary | Depends on your model | ❌ From scratch |

## HireSquire CLI

The official Command Line Interface and MCP Server for **HireSquire**.

## MCP Server Mode

The CLI can also run as an MCP server for Claude Desktop and other MCP-compatible agents:

```bash
# Run as MCP server
npx hiresquire-cli mcp
```

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hiresquire": {
      "command": "npx",
      "args": ["-y", "hiresquire-cli", "mcp"],
      "env": {
        "HIRESQUIRE_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Email: info@hiresquireai.com
- Website: https://hiresquireai.com
- Agent Docs: https://hiresquireai.com/docs/agents
- Ecosystem: https://hiresquireai.com/agents/ecosystem
- MCP Discovery: https://hiresquireai.com/.well-known/mcp.json
