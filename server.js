const express = require("express");
const path = require("path");
require("dotenv").config();
const db = require("./db/database");
const { getCarImages } = require('./utils/imageUpload');
const adminRouter = require('./routes/admin');
const inventoryRouter = require('./routes/inventory');
const app = express();
const PORT = process.env.PORT || 3000;


// Trust the first proxy
app.set('trust proxy', 1);

// Set EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Mount routers
app.use('/admin', adminRouter);
app.use('/inventory', inventoryRouter);

// Routes
app.get("/", async (req, res) => {
  try {
    // Get featured cars that are not sold, limit to 6
    const featuredCars = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM cars WHERE is_featured = 1 AND sold = 0 ORDER BY id DESC LIMIT 6", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Get primary image for each featured car
    const featuredCarsWithImages = await Promise.all(featuredCars.map(async (car) => {
      const images = await getCarImages(car.id);
      const primaryImage = images.find(img => img.is_primary) || images[0];
      return {
        ...car,
        primary_image_url: primaryImage ? primaryImage.image_url : '/images/placeholder-car.svg'
      };
    }));

    res.render("index", { featuredCars: featuredCarsWithImages });
  } catch (err) {
    console.error('Error fetching featured cars:', err);
    res.render("index", { featuredCars: [] });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
