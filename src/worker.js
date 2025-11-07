import { exec } from 'child_process';
import { loadJobs, saveJobs } from './storage.js';
import { fork } from 'child_process';
import fs from 'fs-extra';

const PID_FILE = './.worker_pids.json';
let isShuttingDown = false;

async function executeCommand(job) {
  return new Promise((resolve, reject) => {
    exec(job.command, (error, stdout, stderr) => {
      if (error) return reject({ error, stderr });
      resolve(stdout.trim());
    });
  });
}

async function processJob(workerId) {
  const jobs = await loadJobs();
  const job = jobs.find((j) => j.state === 'pending');
  if (!job) return null;

  job.state = 'processing';
  job.updated_at = new Date().toISOString();
  await saveJobs(jobs);

  console.log(`[Worker ${workerId}] Processing job ${job.id}: "${job.command}"`);

  try {
    const result = await executeCommand(job);
    job.state = 'completed';
    job.updated_at = new Date().toISOString();
    console.log(`[Worker ${workerId}] Completed job ${job.id}: ${result}`);
  } catch (err) {
    console.error(`[Worker ${workerId}] Failed job ${job.id}: ${err.stderr || err.error}`);
    job.attempts += 1;
    job.state = job.attempts < job.max_retries ? 'pending' : 'dead';
    job.updated_at = new Date().toISOString();
  }

  await saveJobs(jobs);
  return job;
}

async function workerLoop(workerId) {
  console.log(`Worker ${workerId} started`);
  while (!isShuttingDown) {
    const job = await processJob(workerId);
    if (!job) {
      await new Promise((r) => setTimeout(r, 2000)); // idle wait
    }
  }
  console.log(`Worker ${workerId} stopped`);
}

export async function startWorkers(count = 1) {
  const pids = [];
  for (let i = 1; i <= count; i++) {
    const pid = forkWorker(i);
    pids.push(pid);
  }
  await fs.writeJSON(PID_FILE, pids);
  console.log(`ᛜ Started ${count} worker(s). PIDs: ${pids.join(', ')}`);
}

function forkWorker(id) {
  const child = fork('./src/workerChild.js', [id]);
  return child.pid;
}

export async function stopWorkers() {
  if (!(await fs.pathExists(PID_FILE))) {
    console.log('No active workers to stop.');
    return;
  }

  const pids = await fs.readJSON(PID_FILE);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`🛑 Stopped worker PID ${pid}`);
    } catch {
      console.warn(`🌠 Worker PID ${pid} already stopped`);
    }
  }
  await fs.remove(PID_FILE);
}
