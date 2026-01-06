const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");

const { User, Task } = require("../models");
const { authenticate } = require("../middleware/authenticate");

// --------------------
// ADMIN GUARD
// --------------------
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ ok: false, error: "Admin only" });
  }
  next();
}

// =====================================================
// BOOTSTRAP FIRST ADMIN (ONE-TIME USE)
// POST /api/admin/bootstrap
// =====================================================
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

    res.json({
      ok: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message });
  }
});

// =====================================================
// ADMIN: WHO AM I
// GET /api/admin/me
// =====================================================
router.get("/me", authenticate, requireAdmin, async (req, res) => {
  res.json({
    ok: true,
    admin: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    },
  });
});

// =====================================================
// ADMIN: LIST USERS
// GET /api/admin/users
// =====================================================
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

// =====================================================
// ADMIN: CHANGE USER ROLE (OPTIONAL)
// POST /api/admin/users/:id/role
// =====================================================
router.post("/users/:id/role", authenticate, requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!["user", "worker", "admin"].includes(role)) {
    return res.status(400).json({ ok: false, error: "Invalid role" });
  }

  const user = await User.findByPk(req.params.id);
  if (!user) {
    return res.status(404).json({ ok: false, error: "User not found" });
  }

  user.role = role;
  await user.save();

  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// =====================================================
// ADMIN: LIST TASKS
// GET /api/admin/tasks
// =====================================================
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

// =====================================================
// ADMIN: CANCEL ANY TASK (OPTIONAL)
// POST /api/admin/tasks/:id/cancel
// =====================================================
router.post("/tasks/:id/cancel", authenticate, requireAdmin, async (req, res) => {
  const task = await Task.findByPk(req.params.id);
  if (!task) {
    return res.status(404).json({ ok: false, error: "Task not found" });
  }

  if (task.status === "completed") {
    return res.status(400).json({ ok: false, error: "Cannot cancel completed task" });
  }

  task.status = "cancelled";
  await task.save();

  res.json({ ok: true, task });
});

// =====================================================
// ADMIN: STATS + REVENUE
// GET /api/admin/stats
// =====================================================
router.get("/stats", authenticate, requireAdmin, async (req, res) => {
  const [
    users,
    workers,
    tasksTotal,
    requested,
    assigned,
    inProgress,
    completed,
    grossCents,
    feesCents,
    paidToWorkersCents,
  ] = await Promise.all([
    User.count(),
    User.count({ where: { role: "worker" } }),
    Task.count(),
    Task.count({ where: { status: "requested" } }),
    Task.count({ where: { status: "assigned" } }),
    Task.count({ where: { status: "in_progress" } }),
    Task.count({ where: { status: "completed" } }),
    Task.sum("total_cents", { where: { status: "completed" } }),
    Task.sum("fee_cents", { where: { status: "completed" } }),
    Task.sum("price_cents", { where: { status: "completed" } }),
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
      grossCents: Number(grossCents || 0),
      feesCents: Number(feesCents || 0),
      paidToWorkersCents: Number(paidToWorkersCents || 0),
    },
  });
});

module.exports = router;
