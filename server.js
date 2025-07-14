const express = require("express");
const path = require("path");
require("dotenv").config();
const db = require("./db/database");
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
app.get("/", (req, res) => {
  res.render("index");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
