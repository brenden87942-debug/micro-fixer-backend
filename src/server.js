require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");

const { sequelize } = require("./models");
const authRoutes = require("./routes/auth");
const taskRoutes = require("./routes/tasks");
const paymentRoutes = require("./routes/payments");
const adminRoutes = require("./routes/admin");
const { initSocket } = require("./socket");

const app = express();

// ✅ allow localhost + your netlify
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://lucent-douhua-947ac5.netlify.app",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);

// ----------------------------------------------------
// ✅ STRIPE WEBHOOK MUST BE RAW (MUST COME BEFORE JSON)
// ----------------------------------------------------
// Your payments router should contain:
// router.post("/webhook", express.raw({ type: "application/json" }), ...)
// This mount ensures Stripe gets the raw body (signature verification works)
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    // pass to the payments router
    next();
  }
);

// ✅ normal JSON parsing for everything else
app.use(bodyParser.json());

// ✅ always respond (prevents Railway 502)
let dbReady = false;
let dbLastError = null;

app.get("/", (req, res) =>
  res.json({ ok: true, service: "micro-fixer-backend", dbReady })
);

app.get("/health", (req, res) =>
  res.json({
    ok: true,
    service: "micro-fixer-backend",
    dbReady,
    dbError: dbLastError ? String(dbLastError) : null,
  })
);

// ✅ routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

// IMPORTANT: This must stay AFTER the raw webhook handler above
app.use("/api/payments", paymentRoutes);

app.use("/api/admin", adminRoutes);

const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 3000;

// ✅ start server FIRST
server.listen(PORT, () => console.log("Backend running on port", PORT));

// ✅ DB connect retries in background (no crash)
async function initDb() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    dbReady = true;
    dbLastError = null;
    console.log("DB synced");
  } catch (e) {
    dbReady = false;
    dbLastError = e?.message || e;
    console.error("DB init error:", e?.message || e);
    setTimeout(initDb, 5000); // retry every 5 sec
  }
}
initDb();
