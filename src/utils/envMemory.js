// envMemory.js
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
let envCache = {};

function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function loadEnv() {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    envCache = parseEnv(content);
  }
}

function getEnv(key, fallback = undefined) {
  return envCache[key] !== undefined ? envCache[key] : fallback;
}

function getAllEnv() {
  return { ...envCache };
}

// Initial load
loadEnv();

export default {
  get: getEnv,
  getAll: getAllEnv,
  reload: loadEnv
};
