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
      carfax_url TEXT NOT NULL,
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
        }
      }
    );
  }
});

// Export database instance
module.exports = db;
