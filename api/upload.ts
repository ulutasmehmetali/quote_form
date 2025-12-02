// Vercel Edge Function: Photo upload with Vercel Blob Storage
import { put } from '@vercel/blob';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,

};



const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB per file
const MAX_TOTAL_SIZE = 2.5 * 1024 * 1024; // 2.5MB total (safe for Vercel Edge with ~33% multipart overhead)
const MAX_FILES = 6;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const formData = await req.formData();
    const entries = formData.getAll('photos');
    
    const files = entries.filter((entry): entry is File => 
      entry instanceof File && typeof entry.name === 'string'
    );

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No files uploaded',
          message: 'Please select at least one photo to upload',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        }
      );
    }

    if (files.length > MAX_FILES) {
      return new Response(
        JSON.stringify({
          error: 'Too many files',
          message: `Maximum ${MAX_FILES} photos allowed`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        }
      );
    }

    // Validate files
    let totalSize = 0;
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid file type',
            message: `Only images allowed: ${ALLOWED_TYPES.join(', ')}`,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return new Response(
          JSON.stringify({
            error: 'File too large',
            message: `Maximum file size: 2MB per photo`,
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          }
        );
      }

      totalSize += file.size;
    }

    // Check total payload size (Vercel Edge ~4.5MB limit, use 2.5MB to account for multipart overhead)
    if (totalSize > MAX_TOTAL_SIZE) {
      return new Response(
        JSON.stringify({
          error: 'Total upload too large',
          message: `Total size exceeds 2.5MB limit. Please reduce number or size of photos.`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        }
      );
    }

    // Upload to Vercel Blob (convert File to ArrayBuffer for Edge runtime)
    const uploadPromises = files.map(async (file) => {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const filename = `photos/${timestamp}-${Math.random().toString(36).substring(7)}.${ext}`;

      // Convert File to ArrayBuffer (required for Edge runtime)
      const arrayBuffer = await file.arrayBuffer();

      const blob = await put(filename, arrayBuffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: file.type,
      });

      return {
        url: blob.url,
        key: filename,
        provider: 'vercel-blob',
      };
    });

    const results = await Promise.all(uploadPromises);

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        files: results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'An error occurred during upload',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      }
    );
  }
}
