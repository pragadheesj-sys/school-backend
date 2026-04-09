const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const path = require("path");

const app = express();
const session = require("express-session");
const cors = require("cors");

app.use(cors());

app.use(session({
  secret: "mysecretkey",
  resave: false,
  saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(express.static("public"));

const Database = require("better-sqlite3");
const db = new Database("database.db");

db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  dob TEXT,
  gender TEXT,
  aadhar TEXT,
  email TEXT,
  father TEXT,
  mother TEXT,
  mobile TEXT,
  address TEXT,
  class TEXT,
  group_name TEXT,
  old_school TEXT,
  referal TEXT,
  teacher TEXT,
  payment_id TEXT,
  status TEXT
)
`);

// ✅ Razorpay — reads from Render environment variables
const razorpay = new Razorpay({
  key_id: "rzp_live_Sb0Vp5t9KWloOG",
  key_secret: "I3ITKQDNUSNsJBCJRDnSwYbn"
});

// ✅ Create Order — 600 rupees = 60000 paise
app.post("/create-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 60000,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });
    console.log("Order created:", order.id, "amount:", order.amount);
    res.json(order);
  } catch (err) {
    console.error("Order creation failed:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// ✅ Verify Payment — uses env secret for signature check
app.post("/verify-payment", (req, res) => {

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    name, dob, gender, aadhar, email,
    father, mother, mobile, address,
    class: cls, group, old_school, referal, teacher
  } = req.body;

  console.log("Verifying payment:", razorpay_order_id, razorpay_payment_id);

  const sign = razorpay_order_id + "|" + razorpay_payment_id;

  const expected = crypto
    .createHmac("sha256", "I3ITKQDNUSNsJBCJRDnSwYbn")
    .update(sign)
    .digest("hex");

  console.log("Expected sig:", expected);
  console.log("Received sig:", razorpay_signature);

  if (expected === razorpay_signature) {
    try {
      const stmt = db.prepare(
        `INSERT INTO students 
        (name, dob, gender, aadhar, email, father, mother, mobile, address, class, group_name, old_school, referal, teacher, payment_id, status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );

      const result = stmt.run(
        name, dob, gender, aadhar, email,
        father, mother, mobile, address,
        cls, group, old_school, referal, teacher,
        razorpay_payment_id, "Paid"
      );

      console.log("DATA SAVED:", name, razorpay_payment_id, "row id:", result.lastInsertRowid);
      res.json({ success: true, id: result.lastInsertRowid });

    } catch (err) {
      console.error("DB insert failed:", err);
      res.status(500).json({ success: false, error: "DB error" });
    }

  } else {
    console.error("Signature MISMATCH — payment not verified");
    res.status(400).json({ success: false, error: "Signature mismatch" });
  }
});

// ✅ Admin Panel
app.get("/admin", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }

  const rows = db.prepare("SELECT * FROM students").all();

  let html = `
  <div style="display:flex; justify-content:space-between; align-items:center;">
    <h2>Admin Panel - All Applications</h2>
    <a href="/download-excel"
       style="background:#2e7d32;color:white;padding:8px 15px;border-radius:5px;text-decoration:none;">
      Download Excel
    </a>
  </div>
  <div style="overflow-x:auto; width:100%;">
  <table border="1" cellpadding="10" style="border-collapse:collapse;min-width:1600px;white-space:nowrap;font-size:14px;">
    <tr style="background:#5f2d8e; color:white;">
      <th>Application ID</th>
      <th>Name</th><th>DOB</th><th>Gender</th><th>Aadhar</th><th>Email</th>
      <th>Father</th><th>Mother</th><th>Mobile</th><th>Address</th>
      <th>Class</th><th>Group</th><th>Old School</th><th>Referral</th>
      <th>Teacher</th><th>Status</th><th>Payment ID</th><th>Download</th>
    </tr>
  `;

  rows.forEach(r => {
    html += `
    <tr>
      <td style="white-space:nowrap;">AVA#${String(r.id).padStart(4,'0')}-2026-2027</td>
      <td style="white-space:nowrap;">${r.name || ''}</td>
      <td style="white-space:nowrap;">${r.dob || ''}</td>
      <td style="white-space:nowrap;">${r.gender || ''}</td>
      <td style="white-space:nowrap;">${r.aadhar || ''}</td>
      <td style="white-space:nowrap;">${r.email || ''}</td>
      <td style="white-space:nowrap;">${r.father || ''}</td>
      <td style="white-space:nowrap;">${r.mother || ''}</td>
      <td style="white-space:nowrap;">${r.mobile || ''}</td>
      <td style="white-space:nowrap;">${r.address || ''}</td>
      <td style="white-space:nowrap;">${r.class || ''}</td>
      <td style="white-space:nowrap;">${r.group_name || ''}</td>
      <td style="white-space:nowrap;">${r.old_school || ''}</td>
      <td style="white-space:nowrap;">${r.referal || ''}</td>
      <td style="white-space:nowrap;">${r.teacher || ''}</td>
      <td style="white-space:nowrap;">${r.status || ''}</td>
      <td style="white-space:nowrap;">${r.payment_id || ''}</td>
      <td>
        <a href="/download-pdf/${r.id}" target="_blank"
           style="background:#5f2d8e;color:white;padding:5px 10px;white-space:nowrap;border-radius:4px;text-decoration:none;">
          PDF
        </a>
      </td>
    </tr>
    `;
  });

  html += "</table></div>";
  res.send(html);
});

// ✅ Admin PDF
const PDFDocument = require("pdfkit");

app.get("/download-pdf/:id", (req, res) => {
  const r = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
  if (!r) return res.send("No Data");

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=student-details.pdf");
  doc.pipe(res);

  doc.font(path.join(__dirname, "fonts", "NotoSansTamil-Regular.ttf"));

  doc.fillColor("#5f2d8e").fontSize(20)
     .text("Ariyava Montessori Matric Hr Sec School", { align: "center" });
  doc.fontSize(14).fillColor("#000")
     .text("Student Admission Details", { align: "center" });
  doc.moveDown(1.5);

  const formattedId = `AVA#${String(r.id).padStart(4, '0')}-2026-2027`;
  const boxY = doc.y;

  doc.rect(40, boxY, 520, 40).stroke("#5f2d8e");
  doc.fontSize(12).fillColor("#000").text(`Application ID: ${formattedId}`, 50, boxY + 12);
  doc.text(`Status: ${r.status}`, 350, boxY + 20);
  doc.moveDown(3);

  const drawRow = (label, value, y) => {
    doc.rect(40, y, 200, 25).stroke();
    doc.rect(240, y, 320, 25).stroke();
    doc.fontSize(11).text(label, 45, y + 7);
    doc.text(value || "-", 245, y + 7);
  };

  let y = doc.y;
  const fields = [
    ["Student Name", r.name || "-"],
    ["Date of Birth", r.dob || "-"],
    ["Gender", r.gender || "-"],
    ["Aadhar Number", r.aadhar || "-"],
    ["Email", r.email || "-"],
    ["Father Name", r.father || "-"],
    ["Mother Name", r.mother || "-"],
    ["Mobile", r.mobile || "-"],
    ["Address", r.address || "-"],
    ["Class Applied", r.class || "-"],
    ["Group", r.group_name || "-"],
    ["Previous School", r.old_school || "-"],
    ["Referral", r.referal || "-"],
    ["Referred Teacher", r.teacher || "-"],
    ["Payment ID", r.payment_id || "-"]
  ];
  fields.forEach(f => { drawRow(f[0], f[1], y); y += 25; });

  doc.moveDown(2);
  doc.fontSize(10).fillColor("#555")
     .text("Generated by Ariyava School Admission System", { align: "center" });
  doc.end();
});

// ✅ User Acknowledgement PDF
app.get("/download-user-pdf/:id", (req, res) => {
  const r = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
  if (!r) return res.send("No Data");

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=application.pdf");
  doc.pipe(res);

  const logoPath = path.join(__dirname, "public", "images", "logo.jpeg");
  const fontPath = path.join(__dirname, "fonts", "NotoSansTamil-Regular.ttf");

  try {
    doc.save();
    doc.opacity(0.15)
       .image(logoPath, doc.page.width / 2 - 175, doc.page.height / 2 - 175, { width: 350 });
    doc.restore();
  } catch (e) {
    console.error("Watermark skipped:", e.message);
  }

  doc.font(fontPath);

  doc.fontSize(20).fillColor("#5f2d8e")
     .text("Ariyava Montessori Matric Hr Sec School", { align: "center" });
  doc.moveDown();
  doc.fontSize(14).fillColor("#000").text("ACKNOWLEDGEMENT RECEIPT", { align: "center" });
  doc.moveDown(2);

  const formattedId = `AVA#${String(r.id).padStart(4, '0')}-2026-2027`;

  doc.fontSize(12);
  doc.text(`Warm greetings of the year!!!!!`);
  doc.text(`Application ID: ${formattedId}`);
  doc.text(`Payment ID: ${r.payment_id}`);
  doc.text(`Amount Paid : 600 (include all tax)`);
  doc.moveDown();

  const drawRow = (label, value, y) => {
    doc.rect(40, y, 200, 25).stroke();
    doc.rect(240, y, 320, 25).stroke();
    doc.fontSize(11).text(label, 45, y + 7);
    doc.text(value || "-", 245, y + 7);
  };

  let y = doc.y;
  const fields = [
    ["Student Name", r.name],
    ["DOB", r.dob],
    ["Gender", r.gender],
    ["Aadhar Number", r.aadhar],
    ["Class", r.class],
    ["Mobile", r.mobile]
  ];
  fields.forEach(f => { drawRow(f[0], f[1], y); y += 25; });

  doc.moveDown(2);
  doc.x = 40;

  const now = new Date();
  doc.fontSize(10).fillColor("#555").text("Submitted on: " + now.toLocaleString());
  doc.moveDown();

  doc.fontSize(11).fillColor("#000")
     .text("Thank you for submitting your details to Ariyava School.", { align: "left" });
  doc.text("Your application is now being processed by our admissions team.", { align: "left" });
  doc.moveDown();

  doc.fontSize(12).fillColor("#5f2d8e").text("What's next?", { align: "left" });
  doc.moveDown(0.5);

  doc.fontSize(11).fillColor("#000")
     .text("One of our admissions officers will call you shortly at the phone number you provided to discuss your application and answer any questions.", { align: "left" });
  doc.text("Please ensure you are available to take the call.", { align: "left" });
  doc.moveDown();

  doc.text("Have questions right now? Feel free to contact our front office:", { align: "left" });
  doc.font("Helvetica-Bold")
     .text("80562 41427, 95143 57140, 76959 95389, 93458 97359", { align: "left" });
  doc.moveDown();
  doc.font("Helvetica");
  doc.text("We look forward to speaking with you soon!", { align: "left" });
  doc.moveDown();
  doc.text("Best regards,", { align: "left" });
  doc.text("The Ariyava Admissions Team", { align: "left" });
  doc.text("Note: This is a computer-generated acknowledgment and does not guarantee final admission.", { align: "left" });
  doc.end();
});

// ✅ Excel Download
const ExcelJS = require("exceljs");

app.get("/download-excel", async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students");
  const rows = db.prepare("SELECT * FROM students").all();

  if (!rows || rows.length === 0) return res.send("No Data");

  sheet.columns = Object.keys(rows[0]).map(key => ({
    header: key.toUpperCase(),
    key: key,
    width: 20
  }));
  rows.forEach(row => sheet.addRow(row));

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=students.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

// ✅ Login Page
app.get("/login", (req, res) => {
  const error = req.query.error;
  res.send(`
  <html>
  <head>
    <title>Admin Login</title>
    <style>
      body { margin:0; height:100vh; display:flex; justify-content:center; align-items:center; background:linear-gradient(135deg,#5f2d8e,#f0e8ff); font-family:Arial; }
      .login-box { background:white; padding:30px; border-radius:10px; width:300px; box-shadow:0 10px 25px rgba(0,0,0,0.2); text-align:center; }
      .login-box h2 { margin-bottom:20px; color:#5f2d8e; }
      .login-box input { width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:5px; font-size:14px; }
      .login-box button { width:100%; padding:10px; background:#5f2d8e; color:white; border:none; border-radius:5px; font-size:15px; cursor:pointer; }
      .login-box button:hover { background:#4a2270; }
      .error { background:#ffe0e0; color:#b00020; padding:8px; border-radius:5px; margin-bottom:10px; font-size:14px; }
    </style>
  </head>
  <body>
    <div class="login-box">
      <h2>Admin Login</h2>
      ${error ? `<div class="error">Invalid Username or Password</div>` : ""}
      <form method="POST" action="/login">
        <input type="text" name="username" placeholder="Username" required>
        <input type="password" name="password" placeholder="Password" required>
        <button type="submit">Login</button>
      </form>
    </div>
  </body>
  </html>
  `);
});

// ✅ Login Check
app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;
  if (username === "ariyavaschool2026" && password === "ariyavamajestic2026") {
    req.session.loggedIn = true;
    res.redirect("/admin");
  } else {
    res.redirect("/login?error=1");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
  
});