import { randomUUID } from 'crypto';
import { writeFile, mkdir, unlink, stat } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { StorageService } from './interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'];
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export class LocalStorageService extends StorageService {
  constructor() {
    super();
    this.uploadDir = join(__dirname, '../../uploads');
  }

  async uploadFile(buffer, filename, mimetype) {
    try {
      const expectedExt = MIME_TO_EXT[mimetype];
      if (!expectedExt) {
        throw new Error(`Invalid MIME type: ${mimetype}`);
      }

      let ext = filename.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        ext = expectedExt;
      }

      await mkdir(this.uploadDir, { recursive: true });

      const key = `${Date.now()}-${randomUUID()}.${ext}`;
      const filePath = join(this.uploadDir, key);

      await writeFile(filePath, buffer);

      const url = `/uploads/${key}`;

      return {
        url,
        key,
        provider: 'local',
      };
    } catch (error) {
      console.error('Local storage upload error:', error);
      throw new Error(`Failed to upload locally: ${error.message}`);
    }
  }

  async deleteFile(key) {
    try {
      const filePath = join(this.uploadDir, key);
      await unlink(filePath);
      return true;
    } catch (error) {
      console.error('Local storage delete error:', error);
      return false;
    }
  }

  async getFileMetadata(key) {
    try {
      const filePath = join(this.uploadDir, key);
      const stats = await stat(filePath);
      
      return {
        url: `/uploads/${key}`,
        size: stats.size,
        contentType: 'application/octet-stream',
      };
    } catch (error) {
      console.error('Local storage metadata error:', error);
      throw new Error(`Failed to get metadata: ${error.message}`);
    }
  }
}
