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

// CORS (add your Netlify + localhost)
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://lucent-douhua-947ac5.netlify.app",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman OK
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked"));
    },
    credentials: true,
  })
);

app.use(bodyParser.json());

// health routes
app.get("/", (req, res) => res.json({ ok: true, service: "micro-fixer-backend" }));
app.get("/health", (req, res) => res.json({ ok: true, service: "micro-fixer-backend" }));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// server + socket
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.sync();
    server.listen(PORT, "0.0.0.0", () => {
      console.log("Backend running on port", PORT);
      console.log("DB synced");
    });
  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
})();
