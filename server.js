const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

const app = express();
const session = require("express-session");

app.use(session({
  secret: "mysecretkey",
  resave: false,
  saveUninitialized: true
}));
app.use(bodyParser.json());
app.use(express.static("public"));

const db = new sqlite3.Database("database.db");

// ✅ NEW TABLE (FULL DATA)
db.run(`
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

// ✅ Razorpay config
const razorpay = new Razorpay({
  key_id: "rzp_live_Sa7xfGd1Qv5fYK",
  key_secret: "yK6Q3DSo9CPT6zWKH9vdBiJt"
});

// ✅ Create Order
app.post("/create-order", async (req, res) => {
  const order = await razorpay.orders.create({
    amount: 60000,
    currency: "INR"
  });
  res.json(order);
});

// ✅ Verify Payment + SAVE FULL DATA
app.post("/verify-payment", (req, res) => {

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,

    name, dob, gender, aadhar, email,
    father, mother, mobile, address,
    class: cls, group, old_school, referal, teacher

  } = req.body;

  const sign = razorpay_order_id + "|" + razorpay_payment_id;

  const expected = crypto
    .createHmac("sha256", "yK6Q3DSo9CPT6zWKH9vdBiJt")
    .update(sign)
    .digest("hex");

  if (expected === razorpay_signature) {

    db.run(
      `INSERT INTO students 
      (name, dob, gender, aadhar, email, father, mother, mobile, address, class, group_name, old_school, referal, teacher, payment_id, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        name, dob, gender, aadhar, email,
        father, mother, mobile, address,
        cls, group, old_school, referal, teacher,
        razorpay_payment_id, "Paid"
      ],
      function(err) {   // ✅ IMPORTANT

        if (err) {
          console.log(err);
          return res.json({ success: false });
        }

        // ✅ NOW lastID WORKS
        res.json({ success: true, id: this.lastID });
      }
    );

  } else {
    res.json({ success: false });
  }
});

// ADMIN PANEL (FULL DATA)
app.get("/admin", (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }
  db.all("SELECT * FROM students", [], (err, rows) => {

    let html = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
    <h2>Admin Panel - All Applications</h2>
    <a href="/download-excel" 
     style="background:#2e7d32;color:white;padding:8px 15px;border-radius:5px;text-decoration:none;">
     Download Excel
    </a>
</div>

   <div style="overflow-x:auto; width:100%;">

<table border="1" cellpadding="10"
style="
border-collapse:collapse;
min-width:1600px;
white-space:nowrap;
font-size:14px;
">
    
    <tr style="background:#5f2d8e; color:white;">
      <th>Application ID</th>
      <th>Name</th>
      <th>DOB</th>
      <th>Gender</th>
      <th>Aadhar</th>
      <th>Email</th>
      <th>Father</th>
      <th>Mother</th>
      <th>Mobile</th>
      <th>Address</th>
      <th>Class</th>
      <th>Group</th>
      <th>Old School</th>
      <th>Referral</th>
      <th>Teacher</th>
      <th>Status</th>
      <th>Payment ID</th>
      <th>Download</th>
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
     style="background:#5f2d8e;color:white;padding:5px 10px; white-space:nowrap; border-radius:4px;text-decoration:none;">
     PDF
  </a>
</td>
      </tr>
      `;
    });

    html += "</table></div>";

    res.send(html);
  });
});

// pdf
// ✅ PDF DOWNLOAD (FIXED)
const PDFDocument = require("pdfkit");

app.get("/download-pdf/:id", (req, res) => {

  db.get("SELECT * FROM students WHERE id = ?", [req.params.id], (err, r) => {

    if (!r) return res.send("No Data");

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=student-details.pdf");

    doc.pipe(res);

    // ✅ FONT (Tamil Support)
    doc.font("./fonts/NotoSansTamil-Regular.ttf");

    // ================= HEADER =================
    doc
      .fillColor("#5f2d8e")
      .fontSize(20)
      .text("Ariyava Montessori Matric Hr Sec School", { align: "center" });

    doc
      .fontSize(14)
      .fillColor("#000")
      .text("Student Admission Details", { align: "center" });

    doc.moveDown(1.5);

    // ================= ID + STATUS BOX =================
    const academicYear = "2026-2027";
    const formattedId = `AVA#${String(r.id).padStart(4, '0')}-${academicYear}`;

    const boxY = doc.y;

doc
  .rect(40, boxY, 520, 40)
  .stroke("#5f2d8e");

doc
  .fontSize(12)
  .fillColor("#000")
  .text(`Application ID: ${formattedId}`, 50, boxY + 12);

doc
  .text(`Status: ${r.status}`, 350, boxY + 20); // slightly down
    doc.moveDown(3);

    // ================= TABLE FUNCTION =================
    const drawRow = (label, value, y) => {
      doc
        .rect(40, y, 200, 25)
        .stroke();

      doc
        .rect(240, y, 320, 25)
        .stroke();

      doc
        .fontSize(11)
        .text(label, 45, y + 7);

      doc
        .text(value || "-", 245, y + 7);
    };

    let y = doc.y;

    // ================= STUDENT DETAILS =================
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
  ["Payment ID", r.payment_id || "-"]  //  FIXED
];

    fields.forEach(f => {
  if (Array.isArray(f)) {
    drawRow(f[0], f[1], y);
    y += 25;
  }
});

    doc.moveDown(2);

    // ================= FOOTER =================
    doc
      .fontSize(10)
      .fillColor("#555")
      .text("Generated by Ariyava School Admission System", { align: "center" });

    doc.end();
  });
});


app.get("/download-user-pdf/:id", (req, res) => {

  db.get("SELECT * FROM students WHERE id = ?", [req.params.id], (err, r) => {

    if (!r) return res.send("No Data");

    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=application.pdf");

    doc.pipe(res);
    //  WATERMARK IMAGE
doc.save();

doc.opacity(0.5)
   .image("D:/school site/public/images/logo.jpeg", 
     doc.page.width / 2 - 175,   // center X
     doc.page.height / 2 - 175,  // center Y
     { width: 350 }
   );

doc.restore();

    // FONT
    doc.font("D:/school site/fonts/NotoSansTamil-Regular.ttf");

    // HEADER
    doc.fontSize(20).fillColor("#5f2d8e")
       .text("Ariyava Montessori Matric Hr Sec School", { align: "center" });

    doc.moveDown();

    doc.fontSize(14).fillColor("#000")
       .text("ACKNOWLEDGEMENT RECEIPT", { align: "center" });

    doc.moveDown(2);

    // ID
    const academicYear = "2026-2027"; // you can change later
    const formattedId = `AVA#${String(r.id).padStart(4, '0')}-${academicYear}`;

    doc.fontSize(12)
    doc.text(`Warm greetings of the year!!!!!`);
    doc.text(`Application ID: ${formattedId}`);
    doc.text(`Payment ID: ${r.payment_id}`);
    doc.text(`Amount Paid : 600`);
    
    doc.moveDown();

    // TABLE STYLE
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

    fields.forEach(f => {
      drawRow(f[0], f[1], y);
      y += 25;
    });

    doc.moveDown(2);
    doc.x = 40;
    // DATE
    const now = new Date();
    doc.fontSize(10).fillColor("#555")
       .text("Submitted on: " + now.toLocaleString());

    doc.moveDown();

doc.fontSize(11).fillColor("#000")
   .text("Thank you for submitting your details to Ariyava School.", { align: "left" });

doc.text("Your application is now being processed by our admissions team.", { align: "left" });

doc.moveDown();

// WHAT’S NEXT
doc.fontSize(12).fillColor("#5f2d8e")
   .text("What’s next?", { align: "left" });

doc.moveDown(0.5);

doc.fontSize(11).fillColor("#000")
   .text(
     "One of our admissions officers will call you shortly at the phone number you provided to discuss your application and answer any questions.",
     { align: "left" }
   );

doc.text(
  "Please ensure you are available to take the call.",
  { align: "left" }
);

doc.moveDown();

// CONTACT

doc.text(
  "Have questions right now? Feel free to contact our front office:",
  { align: "left" }
);

doc.font('Helvetica-Bold')
doc.text(
  "80562 41427, 95143 57140, 76959 95389, 93458 97359",
  { align: "left" }
);

doc.moveDown();
doc.font('Helvetica')
doc.text("We look forward to speaking with you soon!", { align: "left" });

doc.moveDown();

doc.text("Best regards,", { align: "left" });
doc.text("The Ariyava Admissions Team", { align: "left" });
doc.text("Note: This is a computer-generated acknowledgment and does not guarantee final admission.", { align: "left" });
doc.end();
  });
});
//excel
// ✅ EXCEL DOWNLOAD
const ExcelJS = require("exceljs");

app.get("/download-excel", async (req, res) => {

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students");

  db.all("SELECT * FROM students", [], async (err, rows) => {

    if (!rows || rows.length === 0) return res.send("No Data");

    sheet.columns = Object.keys(rows[0]).map(key => ({
      header: key.toUpperCase(),
      key: key,
      width: 20
    }));

    rows.forEach(row => sheet.addRow(row));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=students.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  });
});
// LOGIN PAGE
app.get("/login", (req, res) => {

  const error = req.query.error;

  res.send(`
  <html>
  <head>
    <title>Admin Login</title>
    <style>
      body {
        margin:0;
        height:100vh;
        display:flex;
        justify-content:center;
        align-items:center;
        background: linear-gradient(135deg, #5f2d8e, #f0e8ff);
        font-family: Arial;
      }

      .login-box {
        background:white;
        padding:30px;
        border-radius:10px;
        width:300px;
        box-shadow:0 10px 25px rgba(0,0,0,0.2);
        text-align:center;
      }

      .login-box h2 {
        margin-bottom:20px;
        color:#5f2d8e;
      }

      .login-box input {
        width:100%;
        padding:10px;
        margin:10px 0;
        border:1px solid #ccc;
        border-radius:5px;
        font-size:14px;
      }

      .login-box button {
        width:100%;
        padding:10px;
        background:#5f2d8e;
        color:white;
        border:none;
        border-radius:5px;
        font-size:15px;
        cursor:pointer;
      }

      .login-box button:hover {
        background:#4a2270;
      }

      .error {
        background:#ffe0e0;
        color:#b00020;
        padding:8px;
        border-radius:5px;
        margin-bottom:10px;
        font-size:14px;
      }
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

// LOGIN CHECK
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
app.listen(PORT, () => console.log("Server running on", PORT));