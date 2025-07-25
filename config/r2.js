// Cloudflare R2 Configuration

const { S3Client } = require('@aws-sdk/client-s3');

const r2Config = {
  region: 'auto', // R2 uses 'auto' as region
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  },
  forcePathStyle: true // Required for R2
};

const r2Client = new S3Client(r2Config);

const bucketName = process.env.R2_BUCKET_NAME;

module.exports = {
  r2Client,
  bucketName,
  r2Config
};