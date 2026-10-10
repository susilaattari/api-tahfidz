const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const isS3Configured = Boolean(
  process.env.STORAGE_DRIVER === 'hostinger_s3' &&
  process.env.STORAGE_ACCESS_KEY &&
  process.env.STORAGE_SECRET_KEY
);

let s3Client = null;
if (isS3Configured) {
  s3Client = new S3Client({
    region: process.env.STORAGE_REGION || 'eu-central-1',
    endpoint: process.env.STORAGE_ENDPOINT || 'https://s3.hostinger.com',
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY,
      secretAccessKey: process.env.STORAGE_SECRET_KEY,
    },
    forcePathStyle: true, // Sering dibutuhkan oleh S3-compatible storage seperti Hostinger
  });
}

// Local uploads directory
const localUploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

/**
 * Uploads a file buffer or stream.
 * @param {string} filename - relative file path or name
 * @param {Buffer} buffer - file content buffer
 * @param {string} mimeType - content type
 * @returns {Promise<string>} public URL of the uploaded file
 */
const uploadFile = async (filename, buffer, mimeType = 'application/octet-stream') => {
  if (isS3Configured && s3Client) {
    const bucket = process.env.STORAGE_BUCKET || 'tahfidz-bucket';
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: buffer,
      ContentType: mimeType,
      ACL: 'public-read',
    });
    await s3Client.send(command);
    return `${process.env.STORAGE_ENDPOINT}/${bucket}/${filename}`;
  }

  // Local Storage Fallback
  const targetPath = path.join(localUploadsDir, filename);
  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, buffer);
  const baseUrl = process.env.BASE_URL || 'http://localhost:8099';
  return `${baseUrl}/uploads/${filename}`;
};

/**
 * Deletes a file from storage (Local filesystem or S3).
 * @param {string} fileUrlOrKey - file URL or relative filename
 */
const deleteFile = async (fileUrlOrKey) => {
  if (!fileUrlOrKey) return false;
  try {
    if (isS3Configured && s3Client) {
      const bucket = process.env.STORAGE_BUCKET || 'tahfidz-bucket';
      let key = fileUrlOrKey;
      if (key.includes(`${bucket}/`)) {
        key = key.split(`${bucket}/`)[1];
      }
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await s3Client.send(command);
      return true;
    }

    // Local Storage Fallback
    let relPath = fileUrlOrKey;
    if (relPath.includes('/uploads/')) {
      relPath = relPath.split('/uploads/')[1];
    }
    const fullPath = path.join(localUploadsDir, relPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch (err) {
    console.warn('[Storage] Gagal menghapus file fisik:', err.message);
  }
  return false;
};

module.exports = {
  uploadFile,
  deleteFile,
  localUploadsDir,
  isS3Configured,
};
