import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import logger from './logger.js';

/**
 * Media Handler
 * Handles downloading, processing, and managing media files
 */
export default class MediaHandler {
  constructor(config) {
    this.config = config;
    this.logger = logger.child({ component: 'MediaHandler' });
    this.tmpDir = config.paths.tmp;
    
    // Ensure tmp directory exists
    if (!fs.existsSync(this.tmpDir)) {
      fs.mkdirSync(this.tmpDir, { recursive: true });
    }

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Generate a unique filename
   */
  generateFilename(extension = '') {
    const random = randomBytes(8).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}_${random}${extension}`;
  }

  /**
   * Save buffer to temporary file
   * @param {Buffer} buffer - File buffer
   * @param {string} extension - File extension (e.g., '.jpg')
   * @returns {string} - File path
   */
  saveTemp(buffer, extension = '') {
    const filename = this.generateFilename(extension);
    const filepath = path.join(this.tmpDir, filename);
    
    try {
      fs.writeFileSync(filepath, buffer);
      this.logger.debug(`Saved temp file: ${filename}`);
      return filepath;
    } catch (error) {
      this.logger.error({ error }, 'Failed to save temp file');
      throw error;
    }
  }

  /**
   * Read a file as buffer
   * @param {string} filepath - File path
   * @returns {Buffer}
   */
  readFile(filepath) {
    try {
      return fs.readFileSync(filepath);
    } catch (error) {
      this.logger.error({ error, filepath }, 'Failed to read file');
      throw error;
    }
  }

  /**
   * Delete a file
   * @param {string} filepath - File path
   */
  deleteFile(filepath) {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        this.logger.debug(`Deleted file: ${path.basename(filepath)}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error({ error, filepath }, 'Failed to delete file');
      return false;
    }
  }

  /**
   * Download media from URL
   * @param {string} url - Media URL
   * @returns {Buffer}
   */
  async downloadFromUrl(url) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      this.logger.debug(`Downloaded media from URL: ${url.substring(0, 50)}...`);
      return buffer;
    } catch (error) {
      this.logger.error({ error, url }, 'Failed to download from URL');
      throw error;
    }
  }

  /**
   * Get file size in bytes
   * @param {string} filepath - File path
   * @returns {number}
   */
  getFileSize(filepath) {
    try {
      const stats = fs.statSync(filepath);
      return stats.size;
    } catch (error) {
      this.logger.error({ error, filepath }, 'Failed to get file size');
      return 0;
    }
  }

  /**
   * Get mime type from buffer
   * @param {Buffer} buffer - File buffer
   * @returns {string}
   */
  getMimeType(buffer) {
    // Check file signatures (magic numbers)
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46],
      'video/mp4': [0x66, 0x74, 0x79, 0x70],
      'audio/mpeg': [0x49, 0x44, 0x33], // MP3
      'audio/ogg': [0x4F, 0x67, 0x67, 0x53],
      'application/pdf': [0x25, 0x50, 0x44, 0x46]
    };

    for (const [mimeType, signature] of Object.entries(signatures)) {
      let matches = true;
      for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i]) {
          matches = false;
          break;
        }
      }
      if (matches) return mimeType;
    }

    return 'application/octet-stream'; // Default
  }

  /**
   * Get file extension from mime type
   * @param {string} mimeType - MIME type
   * @returns {string}
   */
  getExtension(mimeType) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'application/pdf': '.pdf',
      'application/zip': '.zip'
    };

    return extensions[mimeType] || '';
  }

  /**
   * Validate media size
   * @param {Buffer|number} bufferOrSize - Buffer or file size
   * @param {string} platform - Platform name
   * @returns {boolean}
   */
  validateSize(bufferOrSize, platform = 'whatsapp') {
    const size = Buffer.isBuffer(bufferOrSize) ? bufferOrSize.length : bufferOrSize;
    const maxSize = platform === 'whatsapp' ? 64 * 1024 * 1024 : 50 * 1024 * 1024;
    
    if (size > maxSize) {
      this.logger.warn(`File size (${size}) exceeds max size (${maxSize}) for ${platform}`);
      return false;
    }
    
    return true;
  }

  /**
   * Convert buffer to base64
   * @param {Buffer} buffer - File buffer
   * @returns {string}
   */
  toBase64(buffer) {
    return buffer.toString('base64');
  }

  /**
   * Convert base64 to buffer
   * @param {string} base64 - Base64 string
   * @returns {Buffer}
   */
  fromBase64(base64) {
    return Buffer.from(base64, 'base64');
  }

  /**
   * Clean up old temporary files
   * Runs periodically to prevent disk space issues
   */
  startCleanup() {
    setInterval(() => {
      try {
        const files = fs.readdirSync(this.tmpDir);
        const now = Date.now();
        const maxAge = 60 * 60 * 1000; // 1 hour

        let deletedCount = 0;

        for (const file of files) {
          const filepath = path.join(this.tmpDir, file);
          const stats = fs.statSync(filepath);
          const age = now - stats.mtimeMs;

          if (age > maxAge) {
            fs.unlinkSync(filepath);
            deletedCount++;
          }
        }

        if (deletedCount > 0) {
          this.logger.info(`Cleaned up ${deletedCount} old temporary file(s)`);
        }
      } catch (error) {
        this.logger.error({ error }, 'Failed to clean up temporary files');
      }
    }, 30 * 60 * 1000); // Run every 30 minutes
  }

  /**
   * Get temporary directory info
   */
  getTmpInfo() {
    try {
      const files = fs.readdirSync(this.tmpDir);
      let totalSize = 0;

      for (const file of files) {
        const filepath = path.join(this.tmpDir, file);
        const stats = fs.statSync(filepath);
        totalSize += stats.size;
      }

      return {
        fileCount: files.length,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        path: this.tmpDir
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get tmp info');
      return null;
    }
  }
}