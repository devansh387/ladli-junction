'use strict';

const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

/**
 * Supabase Storage Client
 * Uses Supabase's free 1GB storage for file uploads (product images, hero media).
 * Files are stored in a public bucket for direct URL access.
 */

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey
);

const BUCKET = 'uploads';

/**
 * Upload a file buffer to Supabase Storage.
 * @param {Buffer} fileBuffer - The file content
 * @param {string} fileName - Unique filename (e.g., "1718123456-abc.jpg")
 * @param {string} mimeType - e.g., "image/jpeg"
 * @returns {Promise<string>} Public URL of the uploaded file
 */
async function uploadFile(fileBuffer, fileName, mimeType) {
  const filePath = `${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error('[STORAGE] Upload failed:', error.message);
    throw new Error('File upload failed: ' + error.message);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Delete a file from Supabase Storage.
 * @param {string} fileUrl - The public URL or path of the file
 */
async function deleteFile(fileUrl) {
  if (!fileUrl) return;

  // Extract path from URL
  let filePath = fileUrl;
  if (fileUrl.includes('/storage/v1/object/public/uploads/')) {
    filePath = fileUrl.split('/storage/v1/object/public/uploads/')[1];
  } else if (fileUrl.startsWith('/uploads/')) {
    filePath = fileUrl.replace('/uploads/', '');
  }

  if (!filePath) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) {
    console.error('[STORAGE] Delete failed:', error.message);
  }
}

/**
 * Ensure the uploads bucket exists (run once on startup).
 */
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024, // 20MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
    });
    if (error && !error.message.includes('already exists')) {
      console.error('[STORAGE] Failed to create bucket:', error.message);
    } else {
      console.log('✅ Supabase storage bucket "uploads" ready.');
    }
  }
}

module.exports = { uploadFile, deleteFile, ensureBucket };
