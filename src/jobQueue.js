import { v4 as uuidv4 } from 'uuid';
import { loadJobs, saveJobs } from './storage.js';
import fs from 'fs-extra';

const PID_FILE = './.worker_pids.json';

export async function enqueueJob(jobInput) {
  const jobs = await loadJobs();

  // Apply defaults
  const job = {
    id: jobInput.id || uuidv4(),
    command: jobInput.command,
    state: 'pending',
    attempts: 0,
    max_retries: jobInput.max_retries || 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  jobs.push(job);
  await saveJobs(jobs);

  return job;
}

export async function listJobs(state) {
  const jobs = await loadJobs();
  if (!state) return jobs; 
  
  return jobs.filter((job) => job.state === state);
}

export async function getStatus() {
  const jobs = await loadJobs();

  const summary = {
    pending: 0,
    processing: 0,
    completed: 0,
    dead: 0,
  };

  for (const job of jobs) {
    if (summary[job.state] !== undefined) {
      summary[job.state]++;
    }
  }

  // Load worker PIDs if available
  let workers = [];
  if (await fs.pathExists(PID_FILE)) {
    try {
      workers = await fs.readJSON(PID_FILE);
      // filter only currently alive PIDs
      workers = workers.filter(pid => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      });
    } catch {
      workers = [];
    }
  }

  return { summary, workerCount: workers.length, workerPids: workers };
}

