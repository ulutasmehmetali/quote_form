/**
 * Storage Service Interface
 * This abstraction allows easy switching between different storage providers
 * (Replit Object Storage, Vercel Blob, Cloudinary, AWS S3, etc.)
 */

export class StorageService {
  /**
   * Upload a file and return its public URL
   * @param {Buffer} buffer - File buffer
   * @param {string} filename - Original filename
   * @param {string} mimetype - File MIME type
   * @returns {Promise<{url: string, key: string}>}
   */
  async uploadFile(buffer, filename, mimetype) {
    throw new Error('uploadFile() must be implemented by subclass');
  }

  /**
   * Delete a file by its key
   * @param {string} key - File key/identifier
   * @returns {Promise<boolean>}
   */
  async deleteFile(key) {
    throw new Error('deleteFile() must be implemented by subclass');
  }

  /**
   * Get file metadata
   * @param {string} key - File key/identifier
   * @returns {Promise<{url: string, size: number, contentType: string}>}
   */
  async getFileMetadata(key) {
    throw new Error('getFileMetadata() must be implemented by subclass');
  }
}
