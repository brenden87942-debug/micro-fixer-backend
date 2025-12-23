const express = require("express");
const router = express.Router();
const { Task, User } = require("../models");
const { authenticate } = require("../middleware/authenticate");
const { emit } = require("../socket");

// Haversine distance in km
function distanceKm(lat1, lng1, lat2, lng2) {
  function toRad(d) {
    return (d * Math.PI) / 180;
  }
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Helpers
function requireWorker(req, res, next) {
  if (!req.user) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (req.user.role !== "worker") {
    return res.status(403).json({ ok: false, error: "Not worker" });
  }
  next();
}

/**
 * USER: create task
 * POST /api/tasks
 */
router.post("/", authenticate, async (req, res) => {
  const { title, description, category, price_cents, lat, lng, address } = req.body;
  try {
    const task = await Task.create({
      title,
      description,
      category,
      price_cents,
      lat,
      lng,
      address,
      userId: req.user.id,
      status: "requested",
    });
    emit("task:new", { task });
    res.json({ ok: true, task });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * USER: list my tasks
 * GET /api/tasks/mine
 */
router.get("/mine", authenticate, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: { userId: req.user.id },
      order: [["updatedAt", "DESC"]],
    });
    res.json({ ok: true, tasks });
  } catch (e) {
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * WORKER: list available tasks (requested only), with scoring
 * GET /api/tasks/available
 */
router.get("/available", authenticate, requireWorker, async (req, res) => {
  try {
    const allTasks = await Task.findAll({ where: { status: "requested" } });

    const workerLat = req.user.locationLat;
    const workerLng = req.user.locationLng;
    const workerSkills = (req.user.skills || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const scored = allTasks.map((task) => {
      let dist = 9999;
      if (
        workerLat != null &&
        workerLng != null &&
        task.lat != null &&
        task.lng != null
      ) {
        dist = distanceKm(workerLat, workerLng, task.lat, task.lng);
      }

      const skillMatch =
        workerSkills.length && task.category
          ? workerSkills.includes(String(task.category).toLowerCase())
          : false;

      let score = 0;
      score -= dist;
      if (skillMatch) score += 10;

      return { task, dist, score };
    });

    scored.sort((a, b) => b.score - a.score);

    res.json({
      ok: true,
      tasks: scored.map((s) => ({
        ...s.task.toJSON(),
        distance_km: s.dist,
        score: s.score,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * WORKER: list my active jobs (assigned + in_progress)
 * GET /api/tasks/assigned
 */
router.get("/assigned", authenticate, requireWorker, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: {
        workerId: req.user.id,
        status: ["assigned", "in_progress"],
      },
      order: [["updatedAt", "DESC"]],
      limit: 50,
    });
    res.json({ ok: true, tasks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * WORKER: history (completed + cancelled)
 * GET /api/tasks/history
 *
 * IMPORTANT: must be above /:id
 */
router.get("/history", authenticate, requireWorker, async (req, res) => {
  try {
    const tasks = await Task.findAll({
      where: {
        workerId: req.user.id,
        status: ["completed", "cancelled"],
      },
      order: [["updatedAt", "DESC"]],
      limit: 50,
    });
    res.json({ ok: true, tasks });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * WORKER: accept a task
 * POST /api/tasks/:id/accept
 */
router.post("/:id/accept", authenticate, requireWorker, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ ok: false, error: "Not found" });
    if (task.status !== "requested") {
      return res.status(400).json({ ok: false, error: "Already taken" });
    }

    task.workerId = req.user.id;
    task.status = "assigned";
    await task.save();

    emit("task:accepted", {
      taskId: task.id,
      userId: task.userId,
      workerId: task.workerId,
    });

    res.json({ ok: true, task });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * WORKER: start a task (assigned -> in_progress)
 * POST /api/tasks/:id/start
 */
router.post("/:id/start", authenticate, requireWorker, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ ok: false, error: "Not found" });
    if (task.workerId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not your task" });
    }
    if (task.status !== "assigned") {
      return res.status(400).json({ ok: false, error: "Task not in assigned state" });
    }

    task.status = "in_progress";
    await task.save();

    emit("task:started", { taskId: task.id, workerId: task.workerId });

    res.json({ ok: true, task });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * WORKER: complete a task (assigned OR in_progress -> completed)
 * POST /api/tasks/:id/complete
 */
router.post("/:id/complete", authenticate, requireWorker, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).json({ ok: false, error: "Not found" });
    if (task.workerId !== req.user.id) {
      return res.status(403).json({ ok: false, error: "Not your task" });
    }
    if (task.status !== "in_progress" && task.status !== "assigned") {
      return res.status(400).json({ ok: false, error: "Task not active" });
    }

    task.status = "completed";
    await task.save();

    emit("task:completed", { taskId: task.id, workerId: task.workerId });

    res.json({ ok: true, task });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * AUTHED: get single task
 * GET /api/tasks/:id
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id, {
      include: [{ model: User, as: "user" }, { model: User, as: "worker" }],
    });
    if (!task) return res.status(404).json({ ok: false, error: "Not found" });
    res.json({ ok: true, task });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

module.exports = router;
