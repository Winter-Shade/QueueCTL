import { v4 as uuidv4 } from 'uuid';
import { loadJobs, saveJobs } from './storage.js';

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
