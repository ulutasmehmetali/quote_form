import express from 'express';
import multer from 'multer';
import { getStorageService } from '../storage/index.js';

const router = express.Router();

// Configure Multer for memory storage (matching production limits)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max per file (matches Vercel Edge production limit)
    files: 6, // Max 6 files
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only images allowed: ${allowedMimes.join(', ')}`));
    }
  },
});

/**
 * POST /api/upload/photos
 * Upload multiple photos (max 6, 2MB each, 2.5MB total)
 * Returns array of uploaded file metadata
 */
router.post('/upload/photos', upload.array('photos', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'No files uploaded',
        message: 'Please select at least one photo to upload'
      });
    }

    // Enforce total size limit (matches production)
    const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
    const MAX_TOTAL_SIZE = 2.5 * 1024 * 1024; // 2.5MB total
    
    if (totalSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({
        error: 'Total upload too large',
        message: 'Total size exceeds 2.5MB limit. Please reduce number or size of photos.'
      });
    }

    const storageService = getStorageService();
    const uploadPromises = req.files.map(file => 
      storageService.uploadFile(file.buffer, file.originalname, file.mimetype)
    );

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      count: results.length,
      files: results.map(result => ({
        url: result.url,
        key: result.key,
        provider: result.provider,
      })),
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message || 'An error occurred during upload',
    });
  }
});

// Note: Delete endpoint removed for simplicity
// Photos are stored permanently once uploaded
// Add delete functionality later if needed

export default router;
