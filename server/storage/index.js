import { LocalStorageService } from './local.js';
import { CloudinaryStorageService } from './cloudinary.js';

let storageInstance = null;

export function getStorageService() {
  if (storageInstance) return storageInstance;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error('CLOUDINARY_CLOUD_NAME is not set; public photo uploads require Cloudinary.');
  }

  storageInstance = new CloudinaryStorageService();
  console.log(`Using Cloudinary (${cloudName}) for uploads`);
  
  return storageInstance;
}

export { LocalStorageService, CloudinaryStorageService };
