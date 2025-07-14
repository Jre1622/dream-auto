const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Create database directory if it doesn't exist
const dbPath = path.resolve(__dirname, "database.db");

// Create and initialize database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err.message);
  } else {
    console.log("Connected to SQLite database");
    // Create cars table
    db.run(
      `CREATE TABLE IF NOT EXISTS cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      year INTEGER NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      price INTEGER NOT NULL,
      mileage INTEGER NOT NULL,
      vin TEXT NOT NULL UNIQUE,
      engine TEXT,
      transmission TEXT,
      features TEXT,
      video_url TEXT,
      carfax_url TEXT,
      is_featured BOOLEAN DEFAULT 0,
      sold BOOLEAN DEFAULT 0
    )`,
      (err) => {
        if (err) {
          console.error("Cars table creation error:", err.message);
        } else {
          console.log("Cars table created or already exists");
        }
      }
    );

    // Create car_images table for managing multiple images per car
    db.run(
      `CREATE TABLE IF NOT EXISTS car_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      car_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      image_key TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_primary BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
    )`,
      (err) => {
        if (err) {
          console.error("Car images table creation error:", err.message);
        } else {
          console.log("Car images table created or already exists");
          
          // Create database indexes for performance optimization
          createDatabaseIndexes();
        }
      }
    );
    
    // Function to create database indexes for optimal query performance
    function createDatabaseIndexes() {
      const indexes = [
        // Cars table indexes - for inventory filtering and sorting
        'CREATE INDEX IF NOT EXISTS idx_cars_sold ON cars(sold)',
        'CREATE INDEX IF NOT EXISTS idx_cars_make ON cars(make)',
        'CREATE INDEX IF NOT EXISTS idx_cars_year ON cars(year)',
        'CREATE INDEX IF NOT EXISTS idx_cars_price ON cars(price)',
        'CREATE INDEX IF NOT EXISTS idx_cars_featured ON cars(is_featured)',
        
        // Car images table indexes - for image queries
        'CREATE INDEX IF NOT EXISTS idx_car_images_car_id ON car_images(car_id)',
        'CREATE INDEX IF NOT EXISTS idx_car_images_display_order ON car_images(car_id, display_order)',
        'CREATE INDEX IF NOT EXISTS idx_car_images_primary ON car_images(car_id, is_primary)'
      ];
      
      indexes.forEach((indexSQL, i) => {
        db.run(indexSQL, (err) => {
          if (err) {
            console.error(`Index creation error (${i + 1}):`, err.message);
          } else {
            console.log(`Database index ${i + 1}/${indexes.length} created successfully`);
          }
        });
      });
    }
  }
});

// Export database instance
module.exports = db;
