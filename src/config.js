import fs from 'fs-extra';

const CONFIG_FILE = './config.json';

// Default configuration
const DEFAULT_CONFIG = {
  base_delay: 2,        // seconds
  max_retries: 3,       // per job (used if job doesn't define its own)
  poll_interval: 2000,  // milliseconds between worker loops
};

export async function loadConfig() {
  const exists = await fs.pathExists(CONFIG_FILE);
  if (!exists) {
    await fs.writeJSON(CONFIG_FILE, DEFAULT_CONFIG, { spaces: 2 });
    return { ...DEFAULT_CONFIG };
  }

  const data = await fs.readJSON(CONFIG_FILE);
  return { ...DEFAULT_CONFIG, ...data }; // fallback defaults
}

export async function saveConfig(newConfig) {
  await fs.writeJSON(CONFIG_FILE, newConfig, { spaces: 2 });
}

export async function setConfigKey(key, value) {
  const config = await loadConfig();
  if (!(key in config)) {
    throw new Error(`Unknown config key "${key}". Valid keys: ${Object.keys(config).join(', ')}`);
  }

  // Convert numeric strings to numbers automatically
  const parsed = isNaN(value) ? value : Number(value);
  config[key] = parsed;
  await saveConfig(config);
  return config;
}
