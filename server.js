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

function vehicleInfoBox(doc, data) {
  const boxX = doc.page.margins.left;
  const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const numCols = 5;
  const colGap = 1;
  const colWidth = (boxWidth - colGap * (numCols - 1)) / numCols;
  const headerH = 20;
  const valueH = 20;
  const boxHeight = headerH + valueH;
  const padX = 6;
  const vinLineH = 18;
  const totalHeight = vinLineH + boxHeight;
  const boxY = doc.y;

  ensureSpace(doc, totalHeight + 12);

  const fields = [
    { label: "Year", value: data.year },
    { label: "Make", value: data.make },
    { label: "Model", value: data.model },
    { label: "Mileage", value: data.mileage },
    { label: "Color", value: data.color },
  ];

  doc.font("Times-Bold").fontSize(10).text(`VIN: ${safeText(data.vin)}`, boxX, boxY + 2, {
    width: boxWidth,
    align: "center",
  });

  const tableY = boxY + vinLineH;
  doc.rect(boxX, tableY, boxWidth, boxHeight).stroke();
  doc.moveTo(boxX, tableY + headerH).lineTo(boxX + boxWidth, tableY + headerH).stroke();

  fields.forEach((field, i) => {
    const x = boxX + i * (colWidth + colGap);

    if (i > 0) {
      doc.moveTo(x, tableY).lineTo(x, tableY + boxHeight).stroke();
    }

    doc.font("Times-Bold").fontSize(10).text(field.label, x + padX, tableY + headerH / 2 - 4, {
      width: colWidth - padX * 2,
      align: "center",
    });

    doc.font("Times-Roman").fontSize(10).text(safeText(field.value) || " ", x + padX, tableY + headerH + valueH / 2 - 4, {
      width: colWidth - padX * 2,
      align: "center",
    });
  });

  doc.x = doc.page.margins.left;
  doc.y = tableY + boxHeight + 6;
}

function infoBox(doc, title, rows) {
  const boxX = doc.page.margins.left;
  const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const rowH = 16;
  const headerH = 18;
  const padX = 8;
  const halfWidth = (boxWidth - 1) / 2;
  const boxHeight = headerH + rows.length * rowH;
  const startY = doc.y;

  ensureSpace(doc, boxHeight + 12);

  doc.rect(boxX, startY, boxWidth, boxHeight).stroke();

  doc.font("Times-Bold").fontSize(11).text(title, boxX + padX, startY + 2, {
    width: boxWidth - padX * 2,
    align: "left",
  });

  rows.forEach((row, i) => {
    const y = startY + headerH + i * rowH + 2;
    if (row.width === "full") {
      doc.font("Times-Bold").fontSize(9.5).text(`${row.label}: `, boxX + padX, y, {
        continued: true,
        width: boxWidth - padX * 2,
      });
      doc.font("Times-Roman").fontSize(9.5).text(safeText(row.value) || " ", {
        width: boxWidth - padX * 2,
      });
      doc.y = y + rowH;
    } else {
      const leftX = boxX + padX;
      const rightX = boxX + halfWidth + 1 + padX;
      const colW = halfWidth - padX * 2;

      doc.moveTo(boxX + halfWidth, startY + headerH + i * rowH)
        .lineTo(boxX + halfWidth, startY + headerH + (i + 1) * rowH)
        .stroke();

      doc.font("Times-Bold").fontSize(9.5).text(`${row.label}: `, leftX, y, {
        continued: true,
        width: colW,
      });
      doc.font("Times-Roman").fontSize(9.5).text(safeText(row.value) || " ", {
        width: colW,
      });

      if (row.label2) {
        doc.font("Times-Bold").fontSize(9.5).text(`${row.label2}: `, rightX, y, {
          continued: true,
          width: colW,
        });
        doc.font("Times-Roman").fontSize(9.5).text(safeText(row.value2) || " ", {
          width: colW,
        });
      }
      doc.y = y + rowH;
    }
  });

  doc.x = doc.page.margins.left;
  doc.y = startY + boxHeight + 6;
}

function pricingTable(doc, rows) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const amountWidth = 80;
  const descWidth = tableWidth - amountWidth - 20;
  const rowHeight = 11;
  const startY = doc.y;
  
  const totalHeight = (rows.length + 1) * rowHeight;
  ensureSpace(doc, totalHeight + 16);
  
  doc.font("Times-Bold").fontSize(10);
  doc.text("Description", left, startY, { width: descWidth });
  doc.text("Amount", left + descWidth + 10, startY, { width: amountWidth, align: "right" });
  
  const headerY = startY + rowHeight - 2;
  doc.moveTo(left, headerY).lineTo(right, headerY).stroke();
  
  let currentY = headerY + 3;
  
  rows.forEach((row, index) => {
    const isLastRow = index === rows.length - 1;
    const isTotalRow = isLastRow && row.bold;
    
    if (row.bold) {
      doc.font("Times-Bold");
    } else {
      doc.font("Times-Roman");
    }
    
    if (isTotalRow) {
      doc.moveTo(left, currentY - 2).lineTo(right, currentY - 2).stroke();
    }
    
    doc.text(row.label, left + 2, currentY, { width: descWidth - 4, lineGap: 0 });
    doc.text(moneyText(row.amount), left + descWidth + 10, currentY, { 
      width: amountWidth, 
      align: "right",
      lineGap: 0 
    });
    
    currentY += rowHeight;
  });
  
  doc.y = currentY + 2;
}

function signatureLine(doc, label, x, y) {
  ensureSpace(doc, 30);
  const startX = x !== undefined ? x : doc.x;
  const lineY = y !== undefined ? y + 18 : doc.y + 18;
  const width = 220;
  doc
    .moveTo(startX, lineY)
    .lineTo(startX + width, lineY)
    .stroke();
  doc.font("Times-Roman").fontSize(9).text(label, startX, lineY + 4, { width });
  if (x === undefined) {
    doc.moveDown(2);
  }
}

function dualSignatureLines(doc, label1, label2) {
  ensureSpace(doc, 30);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const sigWidth = (pageWidth - 40) / 2;
  const startY = doc.y;
  const lineY = startY + 18;
  
  // Left signature line
  doc.moveTo(doc.page.margins.left, lineY)
    .lineTo(doc.page.margins.left + sigWidth, lineY)
    .stroke();
  doc.font("Times-Roman").fontSize(9).text(label1, doc.page.margins.left, lineY + 4);
  
  // Right signature line
  doc.moveTo(doc.page.margins.left + sigWidth + 40, lineY)
    .lineTo(doc.page.margins.left + sigWidth * 2 + 40, lineY)
    .stroke();
  doc.font("Times-Roman").fontSize(9).text(label2, doc.page.margins.left + sigWidth + 40, lineY + 4);
  
  doc.y = lineY + 20;
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

  const headerTop = doc.y;
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftColumnWidth = 250;
  const rightColumnX = doc.page.margins.left + leftColumnWidth + 20;
  const rightColumnWidth = pageWidth - leftColumnWidth - 20;
  const lineH = 18;

  doc.font("Times-Bold").fontSize(14).text(data.dealerName, doc.page.margins.left, headerTop, {
    width: leftColumnWidth,
    align: "left",
  });
  doc.font("Times-Roman").fontSize(10.5).text(data.dealerAddress, doc.page.margins.left, headerTop + lineH, {
    width: leftColumnWidth,
    align: "left",
  });
  doc.text(data.dealerPhone, doc.page.margins.left, headerTop + lineH * 2, {
    width: leftColumnWidth,
    align: "left",
  });

  doc.font("Times-Bold").fontSize(16).text("VEHICLE PURCHASE CONTRACT", rightColumnX, headerTop, {
    width: rightColumnWidth,
    align: "right",
  });
  doc.font("Times-Roman").fontSize(11).text("Bill of Sale & Purchase Agreement", rightColumnX, headerTop + lineH, {
    width: rightColumnWidth,
    align: "right",
  });

  doc.x = doc.page.margins.left;
  doc.y = headerTop + lineH * 3;

  vehicleInfoBox(doc, data);

  infoBox(doc, "Buyer Information", [
    { label: "Full Name", value: data.customerName, label2: "Phone", value2: data.customerPhone },
    { label: "Address", value: data.customerAddress, width: "full" },
    { label: "DL/ID Number", value: data.customerDL, label2: "Email", value2: data.customerEmail },
    { label: "Insurance Company", value: data.customerInsurance, label2: "Policy Number", value2: data.customerPolicyNumber },
  ]);

  if (data.hasCobuyer === "yes") {
    infoBox(doc, "Co-Buyer Information", [
      { label: "Full Name", value: data.cobuyerName, label2: "Phone", value2: data.cobuyerPhone },
      { label: "Address", value: data.cobuyerAddress || data.customerAddress, width: "full" },
      { label: "DL/ID Number", value: data.cobuyerDL, label2: "Email", value2: data.cobuyerEmail },
    ]);
  }

  if (data.hasLienholder === "yes") {
    infoBox(doc, "Lien Holder Information", [
      { label: "Lien Holder", value: data.lienholderName, width: "full" },
      { label: "Address", value: data.lienholderAddress, width: "full" },
      { label: "Account / Loan Number", value: data.lienholderAccount, width: "full" },
    ]);
  }

  ensureSpace(doc, 24);
  doc.moveDown(0.3);
  doc.font("Times-Bold").fontSize(11).text("Pricing Breakdown", { align: "center" });
  doc.moveDown(0.2);
  doc.font("Times-Roman").fontSize(10.5);
  
  pricingTable(doc, pricingRows);

  // Minnesota Legal Disclosures - COMPACT with full width
  const fullWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  
  ensureSpace(doc, 16);
  doc.moveDown(0.2);
  doc.font("Times-Bold").fontSize(11).text("Minnesota Legal Disclosures", doc.page.margins.left, doc.y, { width: fullWidth, align: "center" });
  doc.moveDown(0.2);
  
  // IMPORTANT - full width
  doc.font("Times-Bold").fontSize(8);
  const importantX = doc.page.margins.left;
  const importantY = doc.y;
  doc.text("IMPORTANT: ", importantX, importantY, { continued: true, width: fullWidth });
  doc.font("Times-Roman").text("The information you see on the window form for this vehicle is part of this contract. Information on the window form overrides any contrary provisions in the contract of sale.", { width: fullWidth, lineGap: 0 });
  doc.moveDown(0.15);
  
  // Warranty disclaimer paragraph - full width, smaller font
  doc.font("Times-Roman").fontSize(8);
  doc.text("Any motor vehicle sold to Purchaser by Dealer under this Order is sold ", doc.page.margins.left, doc.y, { width: fullWidth, continued: true });
  doc.font("Times-Bold").text("WITHOUT WARRANTY, EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE", { width: fullWidth, continued: true });
  doc.font("Times-Roman").text(" as to its condition or the condition of any part thereof except as may be specifically provided in a separate writing furnished to Purchaser by Dealer. ", { width: fullWidth, continued: true });
  doc.font("Times-Bold").text("BUYER SHALL NOT BE ENTITLED TO RECOVER FROM THE SELLER ANY CONSEQUENTIAL DAMAGES, DAMAGES TO PROPERTY, DAMAGES FOR LOSS OF USE, LOSS OF TIME, LOSS OF PROFITS OR INCOME OR ANY OTHER INCIDENTAL DAMAGES.", { width: fullWidth });
  doc.font("Times-Roman").text(" The Seller neither assumes nor authorizes any other person to assume for it any liability in connection with the sale of such vehicle. This disclaimer in no way affects the terms of any remaining manufacturer's warranty.", { width: fullWidth, lineGap: 0 });
  doc.moveDown(0.15);
  
  // Pollution Control header
  doc.font("Times-Bold").fontSize(8.5).text("POLLUTION CONTROL SYSTEM DISCLOSURE", doc.page.margins.left, doc.y, { width: fullWidth });
  doc.moveDown(0.1);
  doc.font("Times-Roman").fontSize(8).text("In order to comply with the Minnesota Statutes, Section 325E.0951, no person may transfer a motor vehicle without providing a written disclosure to the transferee (buyer) certifying the condition of the pollution control system. Transferor (seller) hereby certifies, to the best of his/her knowledge, that the pollution control system on this vehicle, including the restricted gasoline pipe, has not been removed, altered, or rendered inoperative.", doc.page.margins.left, doc.y, { width: fullWidth, lineGap: 0 });

  if (safeText(data.warrantyNotes)) {
    doc.moveDown(0.15);
    doc.font("Times-Bold").fontSize(8.5).text("Additional Terms / Warranty Exceptions:", doc.page.margins.left, doc.y, { width: fullWidth });
    doc.moveDown(0.1);
    doc.font("Times-Roman").fontSize(8).text(data.warrantyNotes, doc.page.margins.left, doc.y, { width: fullWidth, lineGap: 0 });
  }

  // Signatures Section - compact
  ensureSpace(doc, 25);
  doc.moveDown(0.3);
  doc.font("Times-Bold").fontSize(11).text("Signatures", { align: "center" });
  doc.moveDown(0.15);
  doc.font("Times-Roman").fontSize(8).text("By signing below, the buyer(s) acknowledge that they have read, understood, and agree to all terms, conditions, and disclosures contained in this contract.", doc.page.margins.left, doc.y, { width: fullWidth, lineGap: 0 });
  doc.moveDown(0.3);
  
  // Buyer and Dealer signatures side by side
  dualSignatureLines(doc, "Buyer Signature", "Dealer Signature");
  
  if (data.hasCobuyer === "yes") {
    // Co-Buyer signature - force left margin
    doc.x = doc.page.margins.left;
    signatureLine(doc, "Co-Buyer Signature");
  }
  
  // Date on left side - force left margin
  doc.x = doc.page.margins.left;
  signatureLine(doc, "Date");
}

app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.locals.dealershipPhone = process.env.DEALERSHIP_PHONE;

app.use("/admin", adminRouter);
app.use("/inventory", inventoryRouter);

app.get("/", async (req, res) => {
  try {
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
    const data = req.body || {};
    data.dealerName = "Dream Auto LLC";
    data.dealerAddress = "580 Dodge Ave NW Ste 4, Elk River, MN 55330";
    data.dealerPhone = process.env.DEALERSHIP_PHONE || "";

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