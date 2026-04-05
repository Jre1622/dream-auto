const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const puppeteer = require("puppeteer");
require("dotenv").config();
const db = require("./db/database");
const adminRouter = require("./routes/admin");
const inventoryRouter = require("./routes/inventory");
const app = express();
const PORT = process.env.PORT || 3000;

// Launch Chrome once and reuse it across requests.
let browser;
let browserPromise;

async function getBrowser() {
  if (browser?.isConnected()) {
    return browser;
  }

  if (browserPromise) {
    return browserPromise;
  }

  browserPromise = puppeteer
    .launch({
      headless: "new",
      timeout: 120000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })
    .then((launchedBrowser) => {
      browser = launchedBrowser;
      browserPromise = null;
      browser.on("disconnected", () => {
        browser = undefined;
      });
      console.log("Puppeteer browser launched");
      return browser;
    })
    .catch((err) => {
      browser = undefined;
      browserPromise = null;
      console.error("Failed to launch Puppeteer browser:", err.message);
      throw err;
    });

  return browserPromise;
}

// Warm the shared browser in the background, but let requests retry if launch is slow.
getBrowser().catch(() => {});

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
    // Get featured cars with their primary images 
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

app.get("/calculator", (req, res) => {
  res.render("calculator");
});

app.get("/contract", (req, res) => {
  res.render("contract");
});

app.post("/generate-contract", async (req, res) => {
  try {
    const data = req.body;

    // Build conditional sections
    // Co-buyer section
    if (data.hasCobuyer === "yes") {
      data.cobuyerSection = `
    <div class="section" style="margin-bottom: 6px;">
      <div class="section-title" style="margin-bottom: 3px;">Co-Buyer Information</div>
      <div class="field-row">
        <div class="field">
          <span class="field-label">Full Name:</span><br>
          <span class="field-value" style="min-width: 95%; min-height: 18px;">${data.cobuyerName || ""}</span>
        </div>
      </div>
      <div class="field-row" style="margin-top: 2px;">
        <div class="field">
          <span class="field-label">Address:</span><br>
          <span class="field-value" style="min-width: 95%; min-height: 18px;">${data.cobuyerAddress || data.customerAddress || ""}</span>
        </div>
      </div>
      <div class="field-row" style="margin-top: 2px;">
        <div class="field">
          <span class="field-label">Phone:</span><br>
          <span class="field-value" style="min-height: 18px;">${data.cobuyerPhone || ""}</span>
        </div>
        <div class="field">
          <span class="field-label">DL/ID Number:</span><br>
          <span class="field-value" style="min-height: 18px;">${data.cobuyerDL || ""}</span>
        </div>
        <div class="field">
          <span class="field-label">Email:</span><br>
          <span class="field-value" style="min-height: 18px;">${data.cobuyerEmail || ""}</span>
        </div>
      </div>
    </div>`;
      data.cobuyerSignature = `
    <div class="cobuyer-sig">
      <p><strong>Co-Buyer Signature:</strong></p>
      <div class="signature-line">Co-Buyer Signature</div>
    </div>`;
    } else {
      data.cobuyerSection = "";
      data.cobuyerSignature = "";
    }

    // Lien holder section
    if (data.hasLienholder === "yes") {
      data.lienholderSection = `
  <div class="section" style="margin-bottom: 6px;">
    <div class="section-title" style="margin-bottom: 3px;">Lien Holder Information</div>
    <div class="lienholder-box" style="padding: 4px 6px;">
      <div class="field-row">
        <div class="field">
          <span class="field-label">Lien Holder:</span><br>
          <span class="field-value" style="min-height: 18px;">${data.lienholderName || ""}</span>
        </div>
        <div class="field">
          <span class="field-label">Account/Loan #:</span><br>
          <span class="field-value" style="min-height: 18px;">${data.lienholderAccount || ""}</span>
        </div>
      </div>
      <div class="field-row" style="margin-top: 2px;">
        <div class="field">
          <span class="field-label">Address:</span><br>
          <span class="field-value" style="min-width: 95%; min-height: 18px;">${data.lienholderAddress || ""}</span>
        </div>
      </div>
    </div>
  </div>`;
    } else {
      data.lienholderSection = "";
    }

    // Warranty exception notes
    if (data["warranty-notes"] && data["warranty-notes"].trim()) {
      data.warrantyNotes = `
    <div style="font-size: 9pt; margin-top: 6px; padding: 6px 8px; border: 1px solid #000;">
      <div style="font-weight: bold; margin-bottom: 3px;">Additional Terms / Warranty Exceptions:</div>
      <p>${data["warranty-notes"]}</p>
    </div>`;
    } else {
      data.warrantyNotes = "";
    }

    // Extra fee rows — only render if filled in
    data.extraFee1Row = "";
    data.extraFee2Row = "";
    if (data.extraFee1Label && data.extraFee1Label.trim()) {
      data.extraFee1Row = `<tr><td>${data.extraFee1Label}</td><td style="text-align: right;">$${data.extraFee1Amount || ""}</td></tr>`;
    }
    if (data.extraFee2Label && data.extraFee2Label.trim()) {
      data.extraFee2Row = `<tr><td>${data.extraFee2Label}</td><td style="text-align: right;">$${data.extraFee2Amount || ""}</td></tr>`;
    }

    // Read template
    let template = fs.readFileSync(path.join(__dirname, "views", "contract-template.html"), "utf8");

    // Inject dealership info (hardcoded for now)
    data.dealerName = "Dream Auto LLC";
    data.dealerAddress = "580 Dodge Ave NW Ste 4, Elk River, MN 55330";
    data.dealerPhone = process.env.DEALERSHIP_PHONE || "";

    // Replace all placeholders
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      template = template.split(placeholder).join(data[key] || "");
    });

    // Generate filename
    const date = new Date().toISOString().split("T")[0];
    const name = (data.customerName || "Unknown").replace(/[^a-zA-Z0-9]/g, "_");
    const vehicle = (data.year || "") + "_" + (data.make || "") + "_" + (data.model || "");
    const filename = `${date}_${name}_${vehicle}.pdf`.replace(/_+/g, "_");

    // Generate PDF using shared browser instance
    const activeBrowser = await getBrowser();
    const page = await activeBrowser.newPage();
    await page.setContent(template, { waitUntil: "networkidle0" });

    const uniqueId = crypto.randomBytes(4).toString("hex");
    const tmpPath = path.join(__dirname, `tmp_${uniqueId}_${filename}`);
    await page.pdf({
      path: tmpPath,
      format: "Letter",
      printBackground: true,
      margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" }
    });

    await page.close();

    // Send as download
    res.download(tmpPath, filename, (err) => {
      fs.unlink(tmpPath, () => {});
      if (err) console.error("Download error:", err);
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating PDF: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
