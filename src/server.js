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

// --- CORS ---
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://lucent-douhua-947ac5.netlify.app",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman/server-to-server
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, true); // TEMP: don't block during deploy debugging
    },
    credentials: true,
  })
);

app.use(bodyParser.json());

// --- Health endpoints (Railway needs something fast) ---
app.get("/", (req, res) => res.status(200).json({ ok: true, service: "micro-fixer-backend" }));
app.get("/health", (req, res) => res.status(200).json({ ok: true, service: "micro-fixer-backend" }));

// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// --- Server ---
const server = http.createServer(app);
initSocket(server);

// IMPORTANT: Railway sets PORT. Must listen on 0.0.0.0
const PORT = Number(process.env.PORT || 3000);

// Start listening FIRST so Railway sees the port open,
// then connect DB (sqlite) after.
server.listen(PORT, "0.0.0.0", async () => {
  console.log("Backend running on port", PORT);
  try {
    await sequelize.sync();
    console.log("DB synced");
  } catch (e) {
    console.error("DB sync failed:", e?.message || e);
  }
});
