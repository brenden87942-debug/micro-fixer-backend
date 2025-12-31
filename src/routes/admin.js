const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const { User, Task } = require("../models");
const { authenticate } = require("../middleware/authenticate");

// --- helpers ---
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  next();
}

/**
 * BOOTSTRAP: create the very first admin user
 * POST /api/admin/bootstrap
 *
 * Protects itself by:
 * - requiring a secret key header
 * - only allowing bootstrap if there is NO admin user yet
 *
 * Header required:
 *   x-admin-bootstrap-key: <ADMIN_BOOTSTRAP_KEY>
 *
 * Body:
 *   { "name": "...", "email": "...", "password": "...", "phone": "..." }
 */
router.post("/bootstrap", async (req, res) => {
  try {
    const key = req.headers["x-admin-bootstrap-key"];
    const requiredKey = process.env.ADMIN_BOOTSTRAP_KEY;

    if (!requiredKey) {
      return res.status(500).json({
        ok: false,
        error: "ADMIN_BOOTSTRAP_KEY not set on server",
      });
    }

    if (!key || key !== requiredKey) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    const existingAdmin = await User.findOne({ where: { role: "admin" } });
    if (existingAdmin) {
      return res.status(409).json({ ok: false, error: "Admin already exists" });
    }

    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: name, email, password",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const admin = await User.create({
      name,
      email,
      phone: phone || null,
      role: "admin",
      password_hash: hash,
      verified: true,
      emailVerifyToken: null,
      locationLat: null,
      locationLng: null,
      skills: null,
    });

    return res.json({
      ok: true,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role },
    });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ ok: false, error: e.message || "Validation error" });
  }
});

/**
 * ADMIN: who am I
 * GET /api/admin/me
 */
router.get("/me", authenticate, requireAdmin, async (req, res) => {
  return res.json({
    ok: true,
    admin: { id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role },
  });
});

/**
 * ADMIN: list users
 * GET /api/admin/users?limit=50&offset=0
 */
router.get("/users", authenticate, requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const offset = Number(req.query.offset || 0);

  const users = await User.findAll({
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    attributes: { exclude: ["password_hash", "emailVerifyToken"] },
  });

  res.json({ ok: true, users, limit, offset });
});

/**
 * ADMIN: list tasks
 * GET /api/admin/tasks?limit=50&offset=0
 */
router.get("/tasks", authenticate, requireAdmin, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const offset = Number(req.query.offset || 0);

  const tasks = await Task.findAll({
    order: [["createdAt", "DESC"]],
    limit,
    offset,
    include: [
      { model: User, as: "user", attributes: ["id", "email", "name", "role"] },
      { model: User, as: "worker", attributes: ["id", "email", "name", "role"] },
    ],
  });

  res.json({ ok: true, tasks, limit, offset });
});

/**
 * ADMIN: quick stats
 * GET /api/admin/stats
 */
router.get("/stats", authenticate, requireAdmin, async (req, res) => {
  const [users, workers, tasksTotal, requested, assigned, inProgress, completed] =
    await Promise.all([
      User.count(),
      User.count({ where: { role: "worker" } }),
      Task.count(),
      Task.count({ where: { status: "requested" } }),
      Task.count({ where: { status: "assigned" } }),
      Task.count({ where: { status: "in_progress" } }),
      Task.count({ where: { status: "completed" } }),
    ]);

  res.json({
    ok: true,
    stats: {
      users,
      workers,
      tasksTotal,
      requested,
      assigned,
      inProgress,
      completed,
    },
  });
});

module.exports = router;
