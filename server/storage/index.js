import { LocalStorageService } from './local.js';
import { CloudinaryStorageService } from './cloudinary.js';

let storageInstance = null;

export function getStorageService() {
  if (storageInstance) return storageInstance;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'demo';
  if (cloudName) {
    storageInstance = new CloudinaryStorageService();
    console.log(`Using Cloudinary (${cloudName}) for uploads`);
    return storageInstance;
  }

  storageInstance = new LocalStorageService();
  console.log('Using local file storage for uploads');
  
  return storageInstance;
}

export { LocalStorageService, CloudinaryStorageService };
