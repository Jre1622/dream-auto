const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db/database');
const router = express.Router();

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
router.get("/", adminLimiter, basicAuth, (req, res) => {
  // Get all cars from database
  db.all("SELECT * FROM cars ORDER BY id DESC", [], (err, cars) => {
    if (err) {
      console.error(err);
      res.render("admin/dashboard", { cars: [], error: "Database error" });
    } else {
      res.render("admin/dashboard", { cars, error: null });
    }
  });
});

// Add Car - GET form
router.get("/add-car", basicAuth, (req, res) => {
  res.render("admin/add-car", { error: null, success: null });
});

// Add Car - POST form
router.post("/add-car", basicAuth, (req, res) => {
  const {
    title, year, make, model, price, mileage, vin, engine, transmission,
    features, primary_image, carfax_url, is_featured
  } = req.body;

  const sql = `INSERT INTO cars 
    (title, year, make, model, price, mileage, vin, engine, transmission, features, primary_image, carfax_url, is_featured) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const params = [
    title, parseInt(year), make, model, parseInt(price), parseInt(mileage),
    vin, engine, transmission, features, primary_image || '/images/coming-soon.webp',
    carfax_url, is_featured ? 1 : 0
  ];

  db.run(sql, params, function(err) {
    if (err) {
      console.error(err);
      res.render("admin/add-car", { 
        error: err.message.includes('UNIQUE') ? 'VIN already exists' : 'Database error',
        success: null 
      });
    } else {
      res.render("admin/add-car", { 
        error: null, 
        success: `Car added successfully! ID: ${this.lastID}` 
      });
    }
  });
});

// Edit Car - GET form
router.get("/edit-car/:id", basicAuth, (req, res) => {
  const carId = req.params.id;
  db.get("SELECT * FROM cars WHERE id = ?", [carId], (err, car) => {
    if (err) {
      console.error(err);
      res.redirect('/admin');
    } else if (!car) {
      res.redirect('/admin');
    } else {
      res.render("admin/edit-car", { car, error: null, success: null });
    }
  });
});

// Edit Car - POST form
router.post("/edit-car/:id", basicAuth, (req, res) => {
  const carId = req.params.id;
  const {
    title, year, make, model, price, mileage, vin, engine, transmission,
    features, primary_image, carfax_url, is_featured, sold
  } = req.body;

  const sql = `UPDATE cars SET 
    title=?, year=?, make=?, model=?, price=?, mileage=?, vin=?, engine=?, 
    transmission=?, features=?, primary_image=?, carfax_url=?, is_featured=?, sold=?
    WHERE id=?`;

  const params = [
    title, parseInt(year), make, model, parseInt(price), parseInt(mileage),
    vin, engine, transmission, features, primary_image, carfax_url, 
    is_featured ? 1 : 0, sold ? 1 : 0, carId
  ];

  db.run(sql, params, function(err) {
    if (err) {
      console.error(err);
      db.get("SELECT * FROM cars WHERE id = ?", [carId], (err, car) => {
        res.render("admin/edit-car", { 
          car, 
          error: err.message.includes('UNIQUE') ? 'VIN already exists' : 'Database error',
          success: null 
        });
      });
    } else {
      db.get("SELECT * FROM cars WHERE id = ?", [carId], (err, car) => {
        res.render("admin/edit-car", { 
          car, 
          error: null, 
          success: 'Car updated successfully!' 
        });
      });
    }
  });
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

module.exports = router;