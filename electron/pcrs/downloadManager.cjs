/**
 * PCRS Download Manager
 * Handles PDF download interception and file management
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { PCRS_PATTERNS } = require('./pcrsConstants.cjs');

class DownloadManager {
  constructor() {
    this.downloadPath = null;
    this.initialized = false;
    this.pendingDownloads = new Map();
    this.completedDownloads = [];
    this.onDownloadComplete = null;
  }

  /**
   * Initialize the download manager (must be called after app is ready)
   */
  async init() {
    if (this.initialized) return;

    this.downloadPath = path.join(app.getPath('userData'), 'pcrs-downloads');
    await this.ensureDownloadDirectory();
    this.initialized = true;
    console.log('[PCRS DownloadManager] Initialized, download path:', this.downloadPath);
  }

  /**
   * Ensure the download directory exists
   */
  async ensureDownloadDirectory() {
    try {
      await fs.mkdir(this.downloadPath, { recursive: true });
    } catch (error) {
      console.error('[PCRS DownloadManager] Failed to create directory:', error);
    }
  }

  /**
   * Handle a download event from Electron session
   * @param {DownloadItem} item - Electron download item
   * @param {string} panelId - Current panel ID for tracking
   * @returns {Promise<Object>} Download result
   */
  handleDownload(item, panelId) {
    return new Promise((resolve, reject) => {
      const originalFilename = item.getFilename();
      const savePath = path.join(this.downloadPath, originalFilename);

      // Track this download
      const downloadId = Date.now().toString();
      this.pendingDownloads.set(downloadId, {
        filename: originalFilename,
        panelId: panelId,
        startedAt: Date.now(),
        savePath: savePath
      });

      item.setSavePath(savePath);

      item.on('updated', (event, state) => {
        if (state === 'interrupted') {
          console.log('[PCRS DownloadManager] Download interrupted:', originalFilename);
        } else if (state === 'progressing') {
          if (item.isPaused()) {
            console.log('[PCRS DownloadManager] Download paused:', originalFilename);
          }
        }
      });

      item.once('done', async (event, state) => {
        const downloadInfo = this.pendingDownloads.get(downloadId);
        this.pendingDownloads.delete(downloadId);

        if (state === 'completed') {
          console.log('[PCRS DownloadManager] Download completed:', originalFilename);

          // Parse filename for metadata
          const metadata = this.parseFilename(originalFilename);

          const result = {
            success: true,
            filename: originalFilename,
            path: savePath,
            panelId: panelId || metadata.panelId,
            month: metadata.month,
            downloadedAt: Date.now()
          };

          this.completedDownloads.push(result);

          // Notify callback if set
          if (this.onDownloadComplete) {
            this.onDownloadComplete(result);
          }

          resolve(result);
        } else {
          console.error('[PCRS DownloadManager] Download failed:', state, originalFilename);
          reject(new Error(`Download ${state}: ${originalFilename}`));
        }
      });
    });
  }

  /**
   * Parse a PCRS statement filename
   * @param {string} filename - Filename to parse
   * @returns {Object} Parsed metadata
   */
  parseFilename(filename) {
    const match = filename.match(PCRS_PATTERNS.FILENAME);
    if (match) {
      return {
        month: match[1],
        panelId: match[2],
        valid: true
      };
    }
    return { valid: false };
  }

  /**
   * Get the download path
   * @returns {string}
   */
  getDownloadPath() {
    return this.downloadPath;
  }

  /**
   * Get list of downloaded PDF files
   * @returns {Promise<Array>} Array of file info objects
   */
  async getDownloadedFiles() {
    if (!this.initialized) return [];

    try {
      const files = await fs.readdir(this.downloadPath);
      const pdfFiles = files.filter(f => f.endsWith('.pdf'));

      const fileInfos = await Promise.all(
        pdfFiles.map(async (filename) => {
          const filePath = path.join(this.downloadPath, filename);
          const stats = await fs.stat(filePath);
          const metadata = this.parseFilename(filename);

          return {
            filename,
            path: filePath,
            size: stats.size,
            downloadedAt: stats.mtime.getTime(),
            ...metadata
          };
        })
      );

      // Sort by download date, newest first
      return fileInfos.sort((a, b) => b.downloadedAt - a.downloadedAt);
    } catch (error) {
      console.error('[PCRS DownloadManager] Failed to list files:', error);
      return [];
    }
  }

  /**
   * Get a specific downloaded file as a buffer
   * @param {string} filename - Filename to read
   * @returns {Promise<Buffer|null>}
   */
  async getFileBuffer(filename) {
    if (!this.initialized) return null;

    try {
      const filePath = path.join(this.downloadPath, filename);
      return await fs.readFile(filePath);
    } catch (error) {
      console.error('[PCRS DownloadManager] Failed to read file:', error);
      return null;
    }
  }

  /**
   * Delete a downloaded file
   * @param {string} filename - Filename to delete
   * @returns {Promise<boolean>}
   */
  async deleteFile(filename) {
    if (!this.initialized) return false;

    try {
      const filePath = path.join(this.downloadPath, filename);
      await fs.unlink(filePath);
      console.log('[PCRS DownloadManager] File deleted:', filename);
      return true;
    } catch (error) {
      console.error('[PCRS DownloadManager] Failed to delete file:', error);
      return false;
    }
  }

  /**
   * Clear all downloaded files
   * @returns {Promise<number>} Number of files deleted
   */
  async clearAllDownloads() {
    if (!this.initialized) return 0;

    try {
      const files = await fs.readdir(this.downloadPath);
      let deleted = 0;

      for (const file of files) {
        if (file.endsWith('.pdf')) {
          await fs.unlink(path.join(this.downloadPath, file));
          deleted++;
        }
      }

      this.completedDownloads = [];
      console.log('[PCRS DownloadManager] Cleared', deleted, 'files');
      return deleted;
    } catch (error) {
      console.error('[PCRS DownloadManager] Failed to clear files:', error);
      return 0;
    }
  }

  /**
   * Get list of completed downloads from this session
   * @returns {Array}
   */
  getCompletedDownloads() {
    return [...this.completedDownloads];
  }

  /**
   * Set callback for download completion
   * @param {Function} callback - Callback function(result)
   */
  setDownloadCompleteCallback(callback) {
    this.onDownloadComplete = callback;
  }
}

// Export singleton instance
const downloadManager = new DownloadManager();
module.exports = { DownloadManager: downloadManager };
