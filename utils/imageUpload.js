const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, bucketName } = require('../config/r2');
const db = require('../db/database');
const path = require('path');

// Allowed file types
const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Upload a single image to R2
 * @param {Object} file - Multer file object
 * @param {number} carId - Car ID
 * @param {number} displayOrder - Display order for the image
 * @returns {Promise<Object>} Upload result
 */
async function uploadImageToR2(file, carId, displayOrder = 0) {
  try {
    // Validate file type (file size limits are handled by multer in admin.js)
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const key = `cars/${carId}/${filename}`;

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        carId: carId.toString(),
        originalName: file.originalname
      }
    });

    await r2Client.send(uploadCommand);

    // Generate public URL for Cloudflare R2 (r2.dev subdomain)
    const imageUrl = `https://pub-2dba18a534a94a19be28f611ae94fce4.r2.dev/${key}`;

    return {
      success: true,
      imageUrl,
      imageKey: key,
      displayOrder
    };
  } catch (error) {
    console.error('R2 upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Save image record to database
 * @param {number} carId - Car ID
 * @param {string} imageUrl - Image URL
 * @param {string} imageKey - R2 object key
 * @param {number} displayOrder - Display order
 * @param {boolean} isPrimary - Whether this is the primary image
 * @returns {Promise<number>} Image ID
 */
function saveImageToDatabase(carId, imageUrl, imageKey, displayOrder = 0, isPrimary = false) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO car_images (car_id, image_url, image_key, display_order, is_primary)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    db.run(query, [carId, imageUrl, imageKey, displayOrder, isPrimary ? 1 : 0], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

/**
 * Upload multiple images for a car
 * @param {Array} files - Array of multer file objects
 * @param {number} carId - Car ID
 * @returns {Promise<Object>} Upload results
 */
async function uploadCarImages(files, carId) {
  const results = {
    successful: [],
    failed: [],
    totalUploaded: 0
  };

  // Get existing images to determine starting display order
  const existingImages = await getCarImages(carId);
  const startingDisplayOrder = existingImages.length + 1;
  const hasExistingImages = existingImages.length > 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const displayOrder = startingDisplayOrder + i;
    // Only set as primary if this is the first image overall (no existing images) and it's the first file
    const isPrimary = !hasExistingImages && i === 0;

    try {
      // Upload to R2
      const uploadResult = await uploadImageToR2(file, carId, displayOrder);
      
      if (uploadResult.success) {
        // Save to database
        const imageId = await saveImageToDatabase(
          carId,
          uploadResult.imageUrl,
          uploadResult.imageKey,
          displayOrder,
          isPrimary
        );

        results.successful.push({
          id: imageId,
          filename: file.originalname,
          url: uploadResult.imageUrl,
          isPrimary
        });
        results.totalUploaded++;
      } else {
        results.failed.push({
          filename: file.originalname,
          error: uploadResult.error
        });
      }
    } catch (error) {
      results.failed.push({
        filename: file.originalname,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Delete image from R2 and database
 * @param {number} imageId - Image ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteCarImage(imageId) {
  try {
    // Get image details from database
    const image = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM car_images WHERE id = ?', [imageId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!image) {
      throw new Error('Image not found');
    }

    // Delete from R2
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: image.image_key
    });
    
    await r2Client.send(deleteCommand);

    // Delete from database
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM car_images WHERE id = ?', [imageId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return true;
  } catch (error) {
    console.error('Delete image error:', error);
    return false;
  }
}

/**
 * Get all images for a car
 * @param {number} carId - Car ID
 * @returns {Promise<Array>} Array of image objects
 */
function getCarImages(carId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM car_images 
      WHERE car_id = ? 
      ORDER BY display_order ASC, created_at ASC
    `;
    
    db.all(query, [carId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
}

module.exports = {
  uploadImageToR2,
  saveImageToDatabase,
  uploadCarImages,
  deleteCarImage,
  getCarImages,
  allowedTypes
};