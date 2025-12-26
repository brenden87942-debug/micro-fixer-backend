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

/**
 * CORS (safe dev default):
 * - allows localhost + any netlify preview
 * - allows curl/postman (no origin)
 */
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin === "http://localhost:5173") return cb(null, true);
      if (origin === "http://127.0.0.1:5173") return cb(null, true);
      if (origin.endsWith(".netlify.app")) return cb(null, true);
      return cb(null, true); // (dev-friendly) if you want strict later, we’ll lock it down
    },
    credentials: true,
  })
);

app.use(bodyParser.json());

// Health checks (for Railway + sanity)
app.get("/", (req, res) => res.json({ ok: true, service: "micro-fixer-backend" }));
app.get("/health", (req, res) => res.json({ ok: true, service: "micro-fixer-backend" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

// Create server + sockets
const server = http.createServer(app);
initSocket(server);

// IMPORTANT: Railway provides PORT
const PORT = process.env.PORT || 3000;

sequelize
  .sync()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log("Backend running on port", PORT);
    });
  })
  .catch((err) => {
    console.error("Sequelize sync failed:", err);
    process.exit(1);
  });
