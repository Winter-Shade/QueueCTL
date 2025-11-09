# QueueCTL: CLI-Based Background Job Queue System

## Overview

QueueCTL is a minimal, production-grade CLI tool for managing background jobs in Node.js. It supports enqueuing jobs, running multiple worker processes, automatic retries with exponential backoff, a Dead Letter Queue (DLQ) for failed jobs, and persistent storage across restarts. Jobs are simple shell commands executed in the background.

Key features:
- Persistent job storage in JSON files.
- Multi-worker support for parallel processing.
- Configurable retries and backoff delays.
- DLQ for permanently failed jobs with retry capabilities.
- Clean CLI interface built with Commander.

This project is designed for simplicity and reliability, using file-based persistence.

## Setup Instructions

### Prerequisites
- Node.js (tested on v20).
- npm (comes with Node.js).

### Installation
1. Clone the repository:
   ```
   git clone 'https://github.com/Winter-Shade/QueueCTL'
   cd queuectl
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Make the CLI globally available (for running as `queuectl` without prefixes):
   ```
   npm link
   ```
   This links the `bin` entry in `package.json` to your system's PATH. Now you can run `queuectl` from anywhere.

   Alternatively, for local runs without linking:
   - Use `npx queuectl <command>` or `node bin/queuectl.js <command>`.

4. Verify installation:
   ```
   queuectl --version
   ```
   Should output `0.1.0`.

### File Structure
- `bin/queuectl.js`: CLI entry point.
- `src/`: Core logic (jobQueue.js, worker.js, etc.).
- `jobs.json`: Persistent job storage (created automatically).
- `config.json`: Configuration file (created with defaults).
- `.worker_pids.json`: Tracks running worker PIDs.

## Usage Examples

QueueCTL provides a straightforward CLI. Run `queuectl --help` for full command list.

### 1. Enqueue a Job
Add a job to the queue. JSON payload must include at least `command`; others are optional.
```
queuectl enqueue '{"command":"echo Hello World"}'
```
Output:
```
🟢 Job enqueued: <uuid>
```

With custom ID and max_retries:
```
queuectl enqueue '{"id":"job1","command":"sleep 2","max_retries":5}'
```
Output:
```
🟢 Job enqueued: job1
```

### 2. List Jobs
List all jobs or filter by state.
```
queuectl list
```
Output:
```
Jobs:
- <uuid> | pending | command="echo Hello World" | attempts=0
- job1 | pending | command="sleep 2" | attempts=0
```

Filter by state:
```
queuectl list --state pending
```
Output (similar, filtered):
```
Jobs [state=pending]:
- ...
```

If no jobs:
```
⏺️ No jobs found.
```

### 3. Manage Workers
Start workers to process jobs.
```
queuectl worker start --count 2
```
Output:
```
✅ Started 2 worker(s). PIDs: 12345, 12346
```
Workers log to console (e.g., `✅ [Worker 1] Completed job <id>: Hello World`).

Stop all workers gracefully:
```
queuectl worker stop
```
Output:
```
🛑 Stopped worker PID 12345
🛑 Stopped worker PID 12346
```
If none running:
```
ℹ️ No active workers to stop.
```

### 4. View Status
Summary of job states and workers.
```
queuectl status
```
Output:
```
📊 Job Summary:
┌───────────┬───────┐
│ (index)   │ Values│
├───────────┼───────┤
│ pending   │ 1     │
│ processing│ 0     │
│ completed │ 1     │
│ dead      │ 0     │
└───────────┴───────┘

👷 Active Workers:
  Count: 2 | PIDs: 12345, 12346
```
If no workers:
```
👷 Active Workers:
  No active workers
```

### 5. Manage Configuration
View current config:
```
queuectl config get
```
Output:
```
┌─────────────┬───────┐
│ (index)     │ Values│
├─────────────┼───────┤
│ base_delay  │ 2     │
│ max_retries │ 3     │
│ poll_interval│ 2000 │
└─────────────┴───────┘
```

Update a key:
```
queuectl config set base_delay 5
```
Output:
```
Updated config: base_delay = 5
```

Invalid key:
```
Unknown config key "invalid". Valid keys: base_delay, max_retries, poll_interval
```

### 6. Manage Dead Letter Queue (DLQ)
List dead jobs:
```
queuectl dlq list
```
Output:
```
DLQ Jobs:
- job2 | state=dead | command="exit 1" | attempts=3 | failed_at=2025-11-09T12:00:00Z
```
If empty:
```
⏺️ No jobs in DLQ.
```

Retry a dead job (resets to pending):
```
queuectl dlq retry job2
```
Output:
```
🔄 Retried job job2 from DLQ
```
Invalid ID:
```
🔴 Job job2 not found in DLQ
```

## Architecture Overview

### Job Lifecycle
1. **Enqueue**: Jobs added via CLI, stored in `jobs.json` with state `pending`.
2. **Processing**: Workers poll for `pending` jobs (considering `next_run_at` for backoff). Claim by updating state to `processing`.
3. **Execution**: Run shell command via `child_process.exec`. On success: state `completed`. On failure: increment `attempts`, calculate backoff (`base_delay ^ attempts` seconds), set `next_run_at`, back to `pending`.
4. **Retries & DLQ**: If `attempts >= max_retries` (job-specific or global), move to `dead`.
5. **Completion/DLQ**: Persistent updates to `jobs.json`.

States: pending → processing → (completed | pending (retry) | dead).

### Data Persistence
- **Jobs**: Array in `jobs.json` (loaded/saved via `fs-extra`).
- **Config**: Defaults in `config.js`, overridden in `config.json`.
- **Workers**: PIDs in `.worker_pids.json` for stop/kill.
- Atomicity: Simple file writes; suitable for low concurrency. For production, consider locks or a database.

### Worker Logic
- Forked child processes (`workerChild.js`) for isolation.
- Loop: Claim job → Execute → Update state → Sleep (poll_interval).
- Graceful shutdown on SIGTERM.
- Multiple workers: Parallel processing, but no built-in load balancing (first-come-first-served via file polling).

## Assumptions & Trade-offs
- **Persistence**: File-based (JSON) for simplicity; no database.   
Trade-off: Easy setup, but potential race conditions in high concurrency   
- **Job Commands**: Limited to shell commands (e.g., no Node.js functions). Assumes safe, non-malicious inputs.
- **Retries**: Exponential backoff uses `Math.pow(base_delay, attempts)`. Global config applies if job lacks `max_retries`.
- **Workers**: Forked for parallelism; no clustering. Idle workers poll every 2s (configurable).

## Testing  

A Bash script is provided to automate end-to-end validation of core flows (config management, enqueuing, listing, worker processing, retries/DLQ, and retrying).

Make the script executable:
```
chmod +x tests/test.sh
```

Run via NPM (recommended, as configured in package.json):
```
npm test
```

## 🚀 Working Demo
<a href="https://drive.google.com/file/d/1nZ93zw6bh2_bt3RFjqm1lxE9rGhlScCy/view?usp=sharing" target="_blank">
  <img src="https://img.shields.io/badge/Live%20Demo-Click%20Here-blue?style=for-the-badge" />
</a>

