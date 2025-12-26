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

// ✅ CORS: allow localhost + your Netlify site + curl (no origin)
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

app.use(bodyParser.json());

// ✅ Always respond (Railway needs this)
app.get("/", (req, res) => res.json({ ok: true, service: "micro-fixer-backend" }));
app.get("/health", (req, res) => res.json({ ok: true, service: "micro-fixer-backend" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Server + sockets
const server = http.createServer(app);
initSocket(server);

// ✅ IMPORTANT: listen immediately for Railway
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});

// ✅ DB init happens AFTER listen so /health still works
(async () => {
  try {
    await sequelize.sync();
    console.log("Sequelize synced ✅");
  } catch (err) {
    console.error("Sequelize sync failed ❌", err);
  }
})();

// Optional: log crashes instead of silent death
process.on("unhandledRejection", (err) => console.error("unhandledRejection", err));
process.on("uncaughtException", (err) => console.error("uncaughtException", err));
