import { LocalStorageService } from './local.js';

let storageInstance = null;

export function getStorageService() {
  if (storageInstance) return storageInstance;
  
  storageInstance = new LocalStorageService();
  console.log('Using local file storage for uploads');
  
  return storageInstance;
}

export { LocalStorageService };
