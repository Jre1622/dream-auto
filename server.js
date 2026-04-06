const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");
require("dotenv").config();
const db = require("./db/database");
const adminRouter = require("./routes/admin");
const inventoryRouter = require("./routes/inventory");
const app = express();
const PORT = process.env.PORT || 3000;

function sanitizeFilenamePart(value) {
  return String(value || "Unknown")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_");
}

function safeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function moneyText(value) {
  const text = safeText(value);
  return text ? `$${text}` : "$0.00";
}

function ensureSpace(doc, minHeight = 24) {
  if (doc.y + minHeight > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 32);
  doc.moveDown(0.5);
  doc.font("Times-Bold").fontSize(12).text(title, { underline: true });
  doc.moveDown(0.3);
  doc.font("Times-Roman").fontSize(10.5);
}

function labelValue(doc, label, value, options = {}) {
  ensureSpace(doc, options.minHeight || 18);
  doc.font("Times-Bold").text(`${label}: `, {
    continued: true,
    width: options.width,
  });
  doc.font("Times-Roman").text(safeText(value) || " ", {
    width: options.width,
  });
}

function plainParagraph(doc, text, options = {}) {
  ensureSpace(doc, options.minHeight || 36);
  doc.font("Times-Roman").fontSize(10).text(safeText(text), {
    align: options.align || "left",
    lineGap: 2,
  });
}

function horizontalRule(doc) {
  ensureSpace(doc, 12);
  const y = doc.y + 2;
  doc
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke();
  doc.moveDown(0.5);
}

function pricingTable(doc, rows) {
  const left = doc.page.margins.left;
  const amountX = doc.page.width - doc.page.margins.right - 110;

  ensureSpace(doc, rows.length * 18 + 28);
  doc.font("Times-Bold").text("Description", left, doc.y, { width: amountX - left - 10 });
  doc.text("Amount", amountX, doc.y, { width: 110, align: "right" });
  horizontalRule(doc);

  rows.forEach((row) => {
    ensureSpace(doc, 18);
    doc.font(row.bold ? "Times-Bold" : "Times-Roman").text(row.label, left, doc.y, {
      width: amountX - left - 10,
    });
    doc.text(moneyText(row.amount), amountX, doc.y, { width: 110, align: "right" });
    doc.moveDown(0.2);
  });
}

function signatureLine(doc, label) {
  ensureSpace(doc, 42);
  const startX = doc.x;
  const y = doc.y + 18;
  const width = 220;
  doc
    .moveTo(startX, y)
    .lineTo(startX + width, y)
    .stroke();
  doc.font("Times-Roman").fontSize(9).text(label, startX, y + 4, { width });
  doc.moveDown(2);
}

function buildContractPdf(doc, data) {
  const pricingRows = [
    { label: "Sale Price", amount: data.salePrice },
    { label: "Sales Tax", amount: data.salesTax },
    { label: "Registration Fee", amount: data.regFee },
    { label: "Documentation Fee", amount: data.docFee },
    { label: "Lien Fee", amount: data.lienFee },
    { label: "Title Fee", amount: data.titleFee },
    { label: "License Plate Fee", amount: data.plateFee },
    { label: "Wheelage Tax", amount: data.wheelage },
    { label: "Transfer Tax", amount: data.transfer },
    { label: "Technology Surcharge", amount: data.tech },
    { label: "Public Safety Fee", amount: data.safety },
    { label: "State Filing Fee", amount: data.filing },
    { label: "Dealer Excise Tax", amount: data.excise },
  ];

  if (safeText(data.extraFee1Label)) {
    pricingRows.push({ label: safeText(data.extraFee1Label), amount: data.extraFee1Amount });
  }
  if (safeText(data.extraFee2Label)) {
    pricingRows.push({ label: safeText(data.extraFee2Label), amount: data.extraFee2Amount });
  }
  pricingRows.push({ label: "Total Out-the-Door Price", amount: data.totalPrice, bold: true });

  doc.info.Title = "Vehicle Purchase Contract";
  doc.info.Author = data.dealerName;
  doc.font("Times-Roman").fontSize(10.5);

  doc.font("Times-Bold").fontSize(14).text(data.dealerName);
  doc.font("Times-Roman").fontSize(10.5).text(data.dealerAddress);
  doc.text(data.dealerPhone);
  doc.moveDown(0.3);
  doc.font("Times-Bold").fontSize(16).text("VEHICLE PURCHASE CONTRACT", { align: "right" });
  doc.font("Times-Roman").fontSize(11).text("Bill of Sale & Purchase Agreement", { align: "right" });
  horizontalRule(doc);

  sectionTitle(doc, "Vehicle Information");
  labelValue(doc, "Year", data.year);
  labelValue(doc, "Make", data.make);
  labelValue(doc, "Model", data.model);
  labelValue(doc, "Mileage", data.mileage);
  labelValue(doc, "Color", data.color);
  labelValue(doc, "VIN", data.vin);

  sectionTitle(doc, "Buyer Information");
  labelValue(doc, "Full Name", data.customerName);
  labelValue(doc, "Address", data.customerAddress);
  labelValue(doc, "Phone", data.customerPhone);
  labelValue(doc, "DL/ID Number", data.customerDL);
  labelValue(doc, "Email", data.customerEmail);
  labelValue(doc, "Insurance Company", data.customerInsurance);
  labelValue(doc, "Policy Number", data.customerPolicyNumber);

  if (data.hasCobuyer === "yes") {
    sectionTitle(doc, "Co-Buyer Information");
    labelValue(doc, "Full Name", data.cobuyerName);
    labelValue(doc, "Address", data.cobuyerAddress || data.customerAddress);
    labelValue(doc, "Phone", data.cobuyerPhone);
    labelValue(doc, "DL/ID Number", data.cobuyerDL);
    labelValue(doc, "Email", data.cobuyerEmail);
  }

  if (data.hasLienholder === "yes") {
    sectionTitle(doc, "Lien Holder Information");
    labelValue(doc, "Lien Holder", data.lienholderName);
    labelValue(doc, "Address", data.lienholderAddress);
    labelValue(doc, "Account / Loan Number", data.lienholderAccount);
  }

  sectionTitle(doc, "Pricing Breakdown");
  pricingTable(doc, pricingRows);

  sectionTitle(doc, "Minnesota Legal Disclosures");
  plainParagraph(doc, "IMPORTANT: The information you see on the window form for this vehicle is part of this contract. Information on the window form overrides any contrary provisions in the contract of sale.");
  doc.moveDown(0.4);
  plainParagraph(doc, "Any motor vehicle sold to Purchaser by Dealer under this Order is sold WITHOUT WARRANTY, EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE as to its condition or the condition of any part thereof except as may be specifically provided in a separate writing furnished to Purchaser by Dealer. BUYER SHALL NOT BE ENTITLED TO RECOVER FROM THE SELLER ANY CONSEQUENTIAL DAMAGES, DAMAGES TO PROPERTY, DAMAGES FOR LOSS OF USE, LOSS OF TIME, LOSS OF PROFITS OR INCOME OR ANY OTHER INCIDENTAL DAMAGES. The Seller neither assumes nor authorizes any other person to assume for it any liability in connection with the sale of such vehicle. This disclaimer in no way affects the terms of any remaining manufacturer's warranty.");
  doc.moveDown(0.4);
  plainParagraph(doc, "POLLUTION CONTROL SYSTEM DISCLOSURE");
  plainParagraph(doc, "In order to comply with the Minnesota Statutes, Section 325E.0951, no person may transfer a motor vehicle without providing a written disclosure to the transferee (buyer) certifying the condition of the pollution control system. Transferor (seller) hereby certifies, to the best of his/her knowledge, that the pollution control system on this vehicle, including the restricted gasoline pipe, has not been removed, altered, or rendered inoperative.");

  if (safeText(data.warrantyNotes)) {
    doc.moveDown(0.4);
    doc.font("Times-Bold").text("Additional Terms / Warranty Exceptions:");
    plainParagraph(doc, data.warrantyNotes);
  }

  sectionTitle(doc, "Signatures");
  plainParagraph(doc, "By signing below, the buyer(s) acknowledge that they have read, understood, and agree to all terms, conditions, and disclosures contained in this contract. The buyer(s) confirm that the vehicle information listed above is accurate and that they are purchasing the vehicle in its current condition.");
  doc.moveDown(0.6);
  signatureLine(doc, "Buyer Signature");
  signatureLine(doc, "Dealer Signature");
  if (data.hasCobuyer === "yes") {
    signatureLine(doc, "Co-Buyer Signature");
  }
  signatureLine(doc, "Date");
}

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
    data.dealerName = "Dream Auto LLC";
    data.dealerAddress = "580 Dodge Ave NW Ste 4, Elk River, MN 55330";
    data.dealerPhone = process.env.DEALERSHIP_PHONE || "";

    // Generate filename
    const date = new Date().toISOString().split("T")[0];
    const name = sanitizeFilenamePart(data.customerName);
    const vehicle = sanitizeFilenamePart(`${data.year || ""}_${data.make || ""}_${data.model || ""}`);
    const filename = `${date}_${name}_${vehicle}.pdf`.replace(/_+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 36, right: 36, bottom: 36, left: 36 },
    });

    doc.pipe(res);
    buildContractPdf(doc, data);
    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating PDF: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
