const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const db = require('../db/database');
const { uploadCarImages, getCarImages, deleteCarImage } = require('../utils/imageUpload');
const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit 
    files: 20 // Maximum 20 files 
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  }
});

// Basic Authentication middleware
function basicAuth(req, res, next) {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Inventory System"');
    return res.status(401).send('Authentication required');
  }
  
  const credentials = Buffer.from(auth.slice(6), 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Inventory System"');
    res.status(401).send('Invalid credentials');
  }
}

// Rate limiting for admin routes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin Dashboard - Main page
router.get("/", adminLimiter, basicAuth, async (req, res) => {
  try {
    // Get all cars from database
    const cars = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM cars ORDER BY id DESC", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get primary image for each car
    const carsWithImages = await Promise.all(cars.map(async (car) => {
      const images = await getCarImages(car.id);
      const primaryImage = images.find(img => img.is_primary) || images[0];
      return {
        ...car,
        primary_image: primaryImage ? primaryImage.image_url : '/images/placeholder-car.svg'
      };
    }));

    res.render("admin/dashboard", { cars: carsWithImages, error: null });
  } catch (err) {
    console.error(err);
    res.render("admin/dashboard", { cars: [], error: "Database error" });
  }
});

// Add Car - GET form
router.get("/add-car", basicAuth, (req, res) => {
  res.render("admin/add-car", { error: null, success: null });
});

// Add Car - POST form with image upload
router.post("/add-car", basicAuth, upload.array('images', 20), async (req, res) => {
  const {
    title, year, make, model, price, mileage, vin, engine, transmission,
    features, carfax_url, is_featured
  } = req.body;

  const sql = `INSERT INTO cars 
    (title, year, make, model, price, mileage, vin, engine, transmission, features, carfax_url, is_featured) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    title, parseInt(year), make, model, parseInt(price), parseInt(mileage),
    vin, engine, transmission, features, carfax_url, is_featured ? 1 : 0
  ];

  try {
    // First, insert the car
    const carId = await new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });

    let uploadResults = { successful: [], failed: [], totalUploaded: 0 };
    
    // If images were uploaded, process them
    if (req.files && req.files.length > 0) {
      uploadResults = await uploadCarImages(req.files, carId);
    }

    const successMessage = `Car added successfully! ID: ${carId}. Images uploaded: ${uploadResults.totalUploaded}/${req.files ? req.files.length : 0}`;
    const errorMessage = uploadResults.failed.length > 0 ? 
      `Some images failed to upload: ${uploadResults.failed.map(f => f.filename).join(', ')}` : null;

    res.render("admin/add-car", { 
      error: errorMessage,
      success: successMessage
    });

  } catch (err) {
    console.error(err);
    res.render("admin/add-car", { 
      error: err.message.includes('UNIQUE') ? 'VIN already exists' : 'Database error',
      success: null 
    });
  }
});

// Edit Car - GET form
router.get("/edit-car/:id", basicAuth, async (req, res) => {
  const carId = req.params.id;
  
  try {
    // Get car details
    const car = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM cars WHERE id = ?", [carId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!car) {
      return res.redirect('/admin');
    }

    // Get car images
    const images = await getCarImages(carId);

    res.render("admin/edit-car", { car, images, error: null, success: null });
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});

// Edit Car - POST form with image upload
router.post("/edit-car/:id", basicAuth, upload.array('images', 20), async (req, res) => {
  const carId = req.params.id;
  console.log('Edit car POST request received for car ID:', carId);
  console.log('Request body:', req.body);
  console.log('Files uploaded:', req.files ? req.files.length : 0);
  
  const {
    title, year, make, model, price, mileage, vin, engine, transmission,
    features, carfax_url, is_featured, sold
  } = req.body;

  const sql = `UPDATE cars SET 
    title=?, year=?, make=?, model=?, price=?, mileage=?, vin=?, engine=?, 
    transmission=?, features=?, carfax_url=?, is_featured=?, sold=?
    WHERE id=?`;

  const params = [
    title, parseInt(year), make, model, parseInt(price), parseInt(mileage),
    vin, engine, transmission, features, carfax_url, 
    is_featured ? 1 : 0, sold ? 1 : 0, carId
  ];

  try {
    console.log('Attempting to update car with SQL:', sql);
    console.log('Parameters:', params);
    
    // Update car details
    await new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) {
          console.error('Database update error:', err);
          reject(err);
        } else {
          console.log('Car updated successfully, changes:', this.changes);
          resolve();
        }
      });
    });

    let uploadResults = { successful: [], failed: [], totalUploaded: 0 };
    
    // If new images were uploaded, process them
    if (req.files && req.files.length > 0) {
      uploadResults = await uploadCarImages(req.files, carId);
    }

    // Get updated car and images
    const car = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM cars WHERE id = ?", [carId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    const images = await getCarImages(carId);

    const successMessage = uploadResults.totalUploaded > 0 ? 
      `Car updated successfully! New images uploaded: ${uploadResults.totalUploaded}/${req.files ? req.files.length : 0}` :
      'Car updated successfully!';
    
    const errorMessage = uploadResults.failed.length > 0 ? 
      `Some images failed to upload: ${uploadResults.failed.map(f => f.filename).join(', ')}` : null;

    res.render("admin/edit-car", { 
      car, 
      images,
      error: errorMessage,
      success: successMessage
    });

  } catch (err) {
    console.error(err);
    
    // Get car and images for error display
    try {
      const car = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM cars WHERE id = ?", [carId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      const images = await getCarImages(carId);
      
      res.render("admin/edit-car", { 
        car, 
        images,
        error: err.message.includes('UNIQUE') ? 'VIN already exists' : 'Database error',
        success: null 
      });
    } catch (fetchErr) {
      res.redirect('/admin');
    }
  }
});

// Delete Car
router.post("/delete-car/:id", basicAuth, (req, res) => {
  const carId = req.params.id;
  db.run("DELETE FROM cars WHERE id = ?", [carId], function(err) {
    if (err) {
      console.error(err);
    }
    res.redirect('/admin');
  });
});

// Toggle Sold Status
router.post("/toggle-sold/:id", basicAuth, (req, res) => {
  const carId = req.params.id;
  db.run("UPDATE cars SET sold = NOT sold WHERE id = ?", [carId], function(err) {
    if (err) {
      console.error(err);
    }
    res.redirect('/admin');
  });
});

// Delete Image
router.post("/delete-image/:imageId", basicAuth, async (req, res) => {
  const imageId = req.params.imageId;
  const carId = req.body.carId;
  
  try {
    const success = await deleteCarImage(imageId);
    if (success) {
      res.redirect(`/admin/edit-car/${carId}?success=Image deleted successfully`);
    } else {
      res.redirect(`/admin/edit-car/${carId}?error=Failed to delete image`);
    }
  } catch (err) {
    console.error(err);
    res.redirect(`/admin/edit-car/${carId}?error=Error deleting image`);
  }
});

// Note: Set Primary Image functionality removed - first image (display_order=1) is automatically primary

// POST /admin/update-image-order/:imageId - Update image display order
router.post('/update-image-order/:imageId', (req, res) => {
  const { imageId } = req.params;
  const { displayOrder } = req.body;
  
  if (!displayOrder || isNaN(displayOrder)) {
    return res.status(400).json({ error: 'Valid display order is required' });
  }
  
  const query = 'UPDATE car_images SET display_order = ? WHERE id = ?';
  
  db.run(query, [parseInt(displayOrder), imageId], function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Failed to update image order' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    res.json({ success: true, message: 'Image order updated successfully' });
  });
});

// POST /admin/update-images-order - Batch update image display orders
router.post('/update-images-order', (req, res) => {
  const { updates } = req.body;
  
  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ error: 'Updates array is required' });
  }
  
  // Prepare batch update with automatic primary flag management
  const updatePromises = updates.map(update => {
    return new Promise((resolve, reject) => {
      const isPrimary = parseInt(update.displayOrder) === 1;
      const query = 'UPDATE car_images SET display_order = ?, is_primary = ? WHERE id = ?';
      db.run(query, [parseInt(update.displayOrder), isPrimary, update.imageId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  });
  
  Promise.all(updatePromises)
    .then(results => {
      const totalUpdated = results.reduce((sum, changes) => sum + changes, 0);
      res.json({ 
        success: true, 
        message: `Updated ${totalUpdated} image(s) successfully`,
        updatedCount: totalUpdated
      });
    })
    .catch(err => {
      console.error('Batch update error:', err);
      res.status(500).json({ error: 'Failed to update image orders' });
    });
});

module.exports = router;