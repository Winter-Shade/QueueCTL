import { loadJobs, saveJobs } from './storage.js';
import { exec } from 'child_process';
import fs from 'fs-extra';
import { loadConfig } from './config.js';

let isRunning = true;
const workerId = process.argv[2];

async function executeCommand(job) {
  return new Promise((resolve, reject) => {
    exec(job.command, (error, stdout, stderr) => {
      if (error) reject(stderr || error.message);
      else resolve(stdout.trim());
    });
  });
}

async function claimJob() {
  const jobs = await loadJobs();
  const now = new Date();
  const jobIndex = jobs.findIndex(
    (j) => j.state === 'pending' && (!j.next_run_at || new Date(j.next_run_at) <= now)
  );
  if (jobIndex === -1) return null;

  jobs[jobIndex].state = 'processing';
  jobs[jobIndex].updated_at = new Date().toISOString();

  await fs.writeJSON('./jobs.json', jobs, { spaces: 2 });

  return jobs[jobIndex];
}

async function processJob() {
  const job = await claimJob(); 
  const config = await loadConfig();
  if (!job) return; 

  console.log(`[Worker ${workerId}] Running: ${job.command}`);

  try {
    const output = await executeCommand(job);
    job.state = 'completed';
    job.next_run_at = null;
    console.log(`[Worker ${workerId}] ✅ Success: ${output}`);
  } catch (err) {
    job.attempts++;
    const baseDelay = config.base_delay || 2;
    const maxRetries = job.max_retries ?? config.max_retries ?? 3;
    const backoffDelay = Math.pow(baseDelay, job.attempts);
    const nextRun = new Date(Date.now() + backoffDelay * 1000);

    if (job.attempts < maxRetries) {
      job.state = 'pending';
      job.next_run_at = nextRun.toISOString();
      console.warn(
        `[Worker ${workerId}] ❌ Failed: ${err} | Retry in ${backoffDelay}s (attempt ${job.attempts}/${maxRetries})`
      );
    } else {
      job.state = 'dead';
      job.next_run_at = null;
      console.error(`[Worker ${workerId}] 💀 Moved to DLQ after ${job.attempts} attempts`);
    }
  }

  job.updated_at = new Date().toISOString();

  const jobs = await loadJobs();
  const idx = jobs.findIndex((j) => j.id === job.id);
  if (idx !== -1) {
    jobs[idx] = job;
    await saveJobs(jobs);
  }
}

async function loop() {
  await new Promise((r) => setTimeout(r, Math.random() * 200));

  while (isRunning) {
    await processJob();
    await new Promise((r) => setTimeout(r, 2000));
  }
}

process.on('SIGTERM', () => {
  console.log(`[Worker ${workerId}] Received stop signal`);
  isRunning = false;
});

loop();
