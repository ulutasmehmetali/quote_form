import express from 'express';
import multer from 'multer';
import { getStorageService } from '../storage/index.js';

const router = express.Router();

const MAGIC_BYTES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
  ],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
};

function validateMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 8) {
    return false;
  }

  if (mimeType.startsWith('video/')) {
    return true; // skip strict magic check for video
  }

  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) {
    return mimeType === 'image/heic';
  }

  return signatures.some(signature => {
    return signature.every((byte, index) => buffer[index] === byte);
  });
}

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return `image_${Date.now()}`;
  }
  
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .substring(0, 100);
  
  return sanitized || `image_${Date.now()}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
    files: 6,
    fieldSize: 20 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
      'video/mp4', 'video/quicktime', 'video/webm'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, HEIC images and MP4/WEBM/MOV videos are allowed.'));
    }
  },
});

router.post('/upload/photos', upload.array('photos', 6), async (req, res) => {
  try {
    // Hard limit: max 4 files
    if ((req.files?.length || 0) > 4) {
      return res.status(400).json({
        error: 'Too many files',
        message: 'You can upload up to 4 files.',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'No files uploaded',
        message: 'Please select at least one photo to upload'
      });
    }

    const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
    const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB total
    
    if (totalSize > MAX_TOTAL_SIZE) {
      return res.status(400).json({
        error: 'Total upload too large',
        message: 'Total size exceeds 20MB limit. Please reduce number or size of files.'
      });
    }

    const validatedFiles = [];
    for (const file of req.files) {
      const normalizedMime = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
      
      if (!validateMagicBytes(file.buffer, normalizedMime)) {
        return res.status(400).json({
          error: 'Invalid file content',
          message: `File "${file.originalname}" does not match its declared type. Please upload valid images.`
        });
      }
      
      validatedFiles.push({
        ...file,
        originalname: sanitizeFilename(file.originalname),
      });
    }

    const storageService = getStorageService();
    const uploadPromises = validatedFiles.map(file => 
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
    const fileSummary = (req.files || []).map(f => ({
      name: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
    }));

    console.error('Upload error:', {
      message: error?.message,
      stack: error?.stack,
      files: fileSummary,
    });
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Each file must be under 20MB.',
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Maximum 6 files allowed.',
      });
    }
    
    res.status(500).json({
      error: 'Upload failed',
      message: 'An error occurred during upload. Please try again.',
      detail: error?.message || 'Unknown error',
    });
  }
});

export default router;
