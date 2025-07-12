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
    // Create table if not exists
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
      primary_image TEXT NOT NULL,
      image_gallery TEXT,
      video_url TEXT,
      carfax_url TEXT NOT NULL,
      is_featured BOOLEAN DEFAULT 0,
      sold BOOLEAN DEFAULT 0
    )`,
      (err) => {
        if (err) {
          console.error("Table creation error:", err.message);
        } else {
          console.log("Cars table created or already exists");
        }
      }
    );
  }
});

// Export database instance
module.exports = db;
