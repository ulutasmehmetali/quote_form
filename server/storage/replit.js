import { Client } from '@replit/object-storage';
import { randomUUID } from 'crypto';
import { StorageService } from './interface.js';

/**
 * Replit Object Storage Implementation
 * Uses @replit/object-storage SDK
 */
export class ReplitStorageService extends StorageService {
  constructor() {
    super();
    this.client = new Client();
    this.bucketName = process.env.REPLIT_BUCKET_NAME || 'miyomint-uploads';
  }

  async uploadFile(buffer, filename, mimetype) {
    try {
      // Generate unique key
      const ext = filename.split('.').pop();
      const key = `photos/${Date.now()}-${randomUUID()}.${ext}`;
      
      // Upload to Replit Object Storage
      await this.client.uploadFromBytes(key, buffer, {
        metadata: {
          contentType: mimetype,
          originalFilename: filename,
        },
      });

      // Get public URL
      const url = await this.client.downloadUrlforKey(key);

      return {
        url,
        key,
        provider: 'replit',
      };
    } catch (error) {
      console.error('Replit storage upload error:', error);
      throw new Error(`Failed to upload to Replit Object Storage: ${error.message}`);
    }
  }

  async deleteFile(key) {
    try {
      await this.client.delete(key);
      return true;
    } catch (error) {
      console.error('Replit storage delete error:', error);
      return false;
    }
  }

  async getFileMetadata(key) {
    try {
      const metadata = await this.client.metadata(key);
      const url = await this.client.downloadUrlforKey(key);
      
      return {
        url,
        size: metadata.size,
        contentType: metadata.metadata?.contentType || 'application/octet-stream',
      };
    } catch (error) {
      console.error('Replit storage metadata error:', error);
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }
}
