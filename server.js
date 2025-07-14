const express = require("express");
const path = require("path");
require("dotenv").config();
const db = require("./db/database");
const adminRouter = require("./routes/admin");
const inventoryRouter = require("./routes/inventory");
const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy
app.set("trust proxy", 1);

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Make dealership phone number available to all templates
app.locals.dealershipPhone = process.env.DEALERSHIP_PHONE;

// Mount routers
app.use("/admin", adminRouter);
app.use("/inventory", inventoryRouter);

// Routes
app.get("/", async (req, res) => {
  try {
    // Optimized query: Get featured cars with their primary images in a single JOIN query
    const featuredCarsWithImages = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          c.*,
          COALESCE(ci.image_url, '/images/placeholder-car.svg') as primary_image_url
        FROM cars c
        LEFT JOIN (
          SELECT 
            car_id,
            image_url,
            ROW_NUMBER() OVER (PARTITION BY car_id ORDER BY is_primary DESC, display_order ASC, id ASC) as rn
          FROM car_images
        ) ci ON c.id = ci.car_id AND ci.rn = 1
        WHERE c.is_featured = 1 AND c.sold = 0
        ORDER BY c.id DESC
        LIMIT 6
      `;

      db.all(query, [], (err, rows) => {
        if (err) {
          console.error("Database error fetching featured cars:", err.message);
          reject(err);
        } else {
          console.log(`Successfully fetched ${rows.length} featured cars`);
          resolve(rows);
        }
      });
    });

    res.render("index", { featuredCars: featuredCarsWithImages });
  } catch (err) {
    console.error("Error in index route:", err.message);
    res.render("index", { featuredCars: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
