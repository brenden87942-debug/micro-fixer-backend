const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

const { Task, Transaction } = require("../models");
const { authenticate } = require("../middleware/authenticate");

// Accept either env name (pick one long-term)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

// ----------------------------
// Helpers (simple + editable)
// ----------------------------
function calcFeeCents(priceCents) {
  // ✅ default: 10% platform fee
  return Math.round(Number(priceCents || 0) * 0.1);
}

function ensurePricing(task) {
  const price = Number(task.price_cents || 0);

  // If you have these columns on Task, we use them. If not, we calculate.
  const fee =
    task.fee_cents != null ? Number(task.fee_cents) : calcFeeCents(price);

  const total =
    task.total_cents != null ? Number(task.total_cents) : price + fee;

  return { price, fee, total };
}

/**
 * Create PaymentIntent
 * POST /api/payments/create-intent
 * body: { taskId }
 */
router.post("/create-intent", authenticate, async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.status(400).json({ ok: false, error: "Missing taskId" });

    const task = await Task.findByPk(taskId);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ ok: false, error: "Task not found" });
    }

    // prevent double charging
    if (task.paidAt) {
      return res.json({ ok: true, alreadyPaid: true, paidAt: task.paidAt });
    }

    const { price, fee, total } = ensurePricing(task);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ ok: false, error: "Task price not set" });
    }
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid totals" });
    }

    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "Stripe secret key not set" });
    }

    // ✅ charge TOTAL (price + fee)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: total,
      currency: "usd",
      metadata: {
        taskId: String(task.id),
        userId: String(req.user.id),
      },
    });

    // Store stripe id + totals on task (safe even if columns don't exist? -> if column missing, Sequelize will throw)
    task.stripePaymentIntentId = paymentIntent.id;

    // If you added fee_cents / total_cents columns, these will persist.
    // If you did NOT add them yet, comment out these two lines.
    if (task.fee_cents == null) task.fee_cents = fee;
    if (task.total_cents == null) task.total_cents = total;

    await task.save();

    // Upsert transaction (no duplicates)
    await Transaction.upsert({
      stripePaymentIntentId: paymentIntent.id,
      amount_cents: total,           // total charged
      platform_fee_cents: fee,       // platform fee
      worker_amount_cents: price,    // worker base pay
      status: paymentIntent.status,
      taskId: task.id,
      userId: req.user.id,
      workerId: task.workerId || null,
    });

    return res.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      totals: { price_cents: price, fee_cents: fee, total_cents: total },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e.message || "Stripe error" });
  }
});

/**
 * OPTIONAL: payment status (for UI polling)
 * GET /api/payments/status?taskId=123
 */
router.get("/status", authenticate, async (req, res) => {
  try {
    const taskId = Number(req.query.taskId);
    if (!taskId) return res.status(400).json({ ok: false, error: "Missing taskId" });

    const task = await Task.findByPk(taskId);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ ok: false, error: "Task not found" });
    }

    const tx = await Transaction.findOne({
      where: { taskId: task.id },
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,
      paid: !!task.paidAt,
      paidAt: task.paidAt,
      stripePaymentIntentId: task.stripePaymentIntentId,
      transactionStatus: tx?.status || null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

/**
 * Stripe webhook (REQUIRED)
 * POST /api/payments/webhook
 *
 * IMPORTANT:
 * - This route MUST receive the RAW body
 * - Your server.js must mount it BEFORE bodyParser.json()
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send("STRIPE_WEBHOOK_SECRET not set");
    }

    const sig = req.headers["stripe-signature"];
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

    // ✅ Payment succeeded
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const taskId = Number(pi.metadata?.taskId);

      if (taskId) {
        const task = await Task.findByPk(taskId);
        if (task && !task.paidAt) {
          task.paidAt = new Date();
          task.stripePaymentIntentId = pi.id;
          await task.save();
        }

        await Transaction.update(
          { status: pi.status },
          { where: { stripePaymentIntentId: pi.id } }
        );
      }
    }

    // ✅ Payment failed (optional tracking)
    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      await Transaction.update(
        { status: pi.status },
        { where: { stripePaymentIntentId: pi.id } }
      );
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
