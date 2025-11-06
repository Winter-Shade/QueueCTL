import fs from 'fs-extra';
const DB_FILE = './jobs.json';

export async function loadJobs() {
  try {
    const exists = await fs.pathExists(DB_FILE);
    if (!exists) return [];
    const data = await fs.readJSON(DB_FILE);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("🔴 Failed to load jobs:", err);
    return [];
  }
}

export async function saveJobs(jobs) {
  await fs.writeJSON(DB_FILE, jobs, { spaces: 2 });
}
