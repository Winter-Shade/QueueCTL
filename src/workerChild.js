import { loadJobs, saveJobs } from './storage.js';
import { exec } from 'child_process';
import fs from 'fs-extra';

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

  const jobIndex = jobs.findIndex((j) => j.state === 'pending');
  if (jobIndex === -1) return null;

  jobs[jobIndex].state = 'processing';
  jobs[jobIndex].updated_at = new Date().toISOString();

  await fs.writeJSON('./jobs.json', jobs, { spaces: 2 });

  return jobs[jobIndex];
}

async function processJob() {
  const job = await claimJob(); 
  if (!job) return; 

  console.log(`[Worker ${workerId}] Running: ${job.command}`);

  try {
    const output = await executeCommand(job);
    job.state = 'completed';
    console.log(`[Worker ${workerId}] Success: ${output}`);
  } catch (err) {
    job.attempts++;
    job.state = job.attempts < job.max_retries ? 'pending' : 'dead';
    console.error(`[Worker ${workerId}] Failed: ${err}`);
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
