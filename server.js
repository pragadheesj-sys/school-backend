const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const path = require("path");
const session = require("express-session");
const cors = require("cors");
const ws = require("ws");

const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(session({
  secret: "mysecretkey",
  resave: false,
  saveUninitialized: true
}));

// ✅ SUPABASE
const supabase = createClient(
  "https://kxgupcilyyewiwrkxxcc.supabase.co",
  "YOUR_SUPABASE_KEY",
  {
    realtime: {
      transport: ws
    }
  }
);

// ✅ Razorpay
const razorpay = new Razorpay({
  key_id: "rzp_live_Sb0Vp5t9KWloOG",
  key_secret: "I3ITKQDNUSNsJBCJRDnSwYbn"
});

// ✅ CREATE ORDER
app.post("/create-order", async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 60000,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order failed" });
  }
});

// ✅ VERIFY PAYMENT + SAVE
app.post("/verify-payment", async (req, res) => {
  try {
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
      .createHmac("sha256", "I3ITKQDNUSNsJBCJRDnSwYbn")
      .update(sign)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false });
    }

    const { data, error } = await supabase
      .from("students")
      .insert([{
        name, dob, gender, aadhar, email,
        father, mother, mobile, address,
        class: cls,
        group_name: group,
        old_school,
        referal,
        teacher,
        payment_id: razorpay_payment_id,
        status: "Paid"
      }])
      .select();

    if (error) {
      console.error(error);
      return res.status(500).json({ success: false });
    }

    res.json({ success: true, id: data[0].id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ✅ Admin Panel (Supabase + OLD DESIGN)
app.get("/admin", async (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }

  try {
    const { data: rows, error } = await supabase
      .from("students")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.send("Database Error");
    }

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

  } catch (err) {
    console.error("Admin error:", err);
    res.send("Server Error");
  }
});// ✅ Admin Panel (Supabase + OLD DESIGN)
app.get("/admin", async (req, res) => {
  if (!req.session.loggedIn) {
    return res.redirect("/login");
  }

  try {
    const { data: rows, error } = await supabase
      .from("students")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.send("Database Error");
    }

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

  } catch (err) {
    console.error("Admin error:", err);
    res.send("Server Error");
  }
});

// ✅ Admin PDF (Supabase + ORIGINAL DESIGN)

app.get("/download-pdf/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      console.error("Supabase fetch error:", error);
      return res.send("No Data");
    }

    const r = data; // keep same variable name (IMPORTANT)

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=student-details.pdf");
    doc.pipe(res);

    // ✅ KEEP YOUR ORIGINAL FONT
    doc.font(path.join(__dirname, "fonts", "NotoSansTamil-Regular.ttf"));

    doc.fillColor("#5f2d8e").fontSize(20)
       .text("Ariyava Montessori Matric Hr Sec School", { align: "center" });

    doc.fontSize(14).fillColor("#000")
       .text("Student Admission Details", { align: "center" });

    doc.moveDown(1.5);

    const formattedId = `AVA#${String(r.id).padStart(4, '0')}-2026-2027`;
    const boxY = doc.y;

    doc.rect(40, boxY, 520, 40).stroke("#5f2d8e");

    doc.fontSize(12).fillColor("#000")
       .text(`Application ID: ${formattedId}`, 50, boxY + 12);

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

    fields.forEach(f => {
      drawRow(f[0], f[1], y);
      y += 25;
    });

    doc.moveDown(2);

    doc.fontSize(10).fillColor("#555")
       .text("Generated by Ariyava School Admission System", { align: "center" });

    doc.end();

  } catch (err) {
    console.error("PDF error:", err);
    res.send("Server Error");
  }
});
// ✅ User Acknowledgement PDF (Supabase + ORIGINAL DESIGN)
app.get("/download-user-pdf/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !data) {
      console.error("Supabase fetch error:", error);
      return res.send("No Data");
    }

    const r = data; // keep same variable name

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=application.pdf");
    doc.pipe(res);

    const logoPath = path.join(__dirname, "public", "images", "logo.jpeg");
    const fontPath = path.join(__dirname, "fonts", "NotoSansTamil-Regular.ttf");

    // ✅ Watermark (same as before)
    try {
      doc.save();
      doc.opacity(0.15)
         .image(logoPath, doc.page.width / 2 - 175, doc.page.height / 2 - 175, { width: 350 });
      doc.restore();
    } catch (e) {
      console.error("Watermark skipped:", e.message);
    }

    // ✅ Font
    doc.font(fontPath);

    // ✅ Header
    doc.fontSize(20).fillColor("#5f2d8e")
       .text("Ariyava Montessori Matric Hr Sec School", { align: "center" });

    doc.moveDown();
    doc.fontSize(14).fillColor("#000")
       .text("ACKNOWLEDGEMENT RECEIPT", { align: "center" });

    doc.moveDown(2);

    const formattedId = `AVA#${String(r.id).padStart(4, '0')}-2026-2027`;

    // ✅ Top info
    doc.fontSize(12);
    doc.text(`Warm greetings of the year!!!!!`);
    doc.text(`Application ID: ${formattedId}`);
    doc.text(`Payment ID: ${r.payment_id}`);
    doc.text(`Amount Paid : 600 (include all tax)`);
    doc.moveDown();

    // ✅ Table rows
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

    // ✅ Footer content
    const now = new Date();
    doc.fontSize(10).fillColor("#555")
       .text("Submitted on: " + now.toLocaleString());

    doc.moveDown();

    doc.fontSize(11).fillColor("#000")
       .text("Thank you for submitting your details to Ariyava School.", { align: "left" });

    doc.text("Your application is now being processed by our admissions team.", { align: "left" });

    doc.moveDown();

    doc.fontSize(12).fillColor("#5f2d8e")
       .text("What's next?", { align: "left" });

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

  } catch (err) {
    console.error("User PDF error:", err);
    res.send("Server Error");
  }
});

// ✅ EXCEL (SUPABASE)
app.get("/download-excel", async (req, res) => {
  const { data: rows, error } = await supabase
    .from("students")
    .select("*");

  if (error || !rows || rows.length === 0) {
    return res.send("No Data");
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Students");

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

// ✅ LOGIN PAGE (UNCHANGED UI)
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
      .login-box input { width:100%; padding:10px; margin:10px 0; border:1px solid #ccc; border-radius:5px; }
      .login-box button { width:100%; padding:10px; background:#5f2d8e; color:white; border:none; border-radius:5px; }
      .error { background:#ffe0e0; color:#b00020; padding:8px; border-radius:5px; margin-bottom:10px; }
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

app.post("/login", express.urlencoded({ extended: true }), (req, res) => {
  const { username, password } = req.body;

  if (username === "ariyavaschool2026" && password === "ariyavamajestic2026") {
    req.session.loggedIn = true;
    res.redirect("/admin");
  } else {
    res.redirect("/login?error=1");
  }
});

app.listen(3000, () => console.log("Server running on 3000"));