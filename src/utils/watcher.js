import fs from 'fs';
import path from 'path';

/**
 * Watcher utility for hot-reloading plugins and .env changes
 * Usage:
 *   watchFilesAndFolders({
 *     files: ['.env'],
 *     folders: ['./src/plugins'],
 *     onChange: (type, changedPath) => { ... }
 *   });
 */
export default function watchFilesAndFolders({ files = [], folders = [], onChange }) {
  // Watch files
  for (const file of files) {
    fs.watchFile(file, { interval: 1000 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        onChange('file', file);
      }
    });
  }

  // Watch folders (for new/removed/changed files)
  for (const folder of folders) {
    fs.watch(folder, { recursive: false }, (eventType, filename) => {
      if (filename) {
        const changedPath = path.join(folder, filename);
        onChange('folder', changedPath);
      }
    });
  }
}
