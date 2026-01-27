// storageUtil.js
// Utility for reading/writing to storage/storage.json
import fs from 'fs';
import path from 'path';

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'storage.json');

function readStorage() {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const raw = fs.readFileSync(STORAGE_PATH, 'utf-8');
      return JSON.parse(raw.replace(/^\/\/.*$/mg, ''));
    }
  } catch {}
  return {};
}

function writeStorage(data) {
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function getStickerCommands() {
  const storage = readStorage();
  return storage.stickerCommands || {};
}

function setStickerCommands(stickerCommands) {
  const storage = readStorage();
  storage.stickerCommands = stickerCommands;
  writeStorage(storage);
}

export default {
  readStorage,
  writeStorage,
  getStickerCommands,
  setStickerCommands
};
