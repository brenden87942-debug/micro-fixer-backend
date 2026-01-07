const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const { Task } = require("../models");

router.post("/", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"];
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!whSecret) {
      return res.status(500).send("STRIPE_WEBHOOK_SECRET not set");
    }

    const event = stripe.webhooks.constructEvent(req.body, sig, whSecret);

    // ✅ When Checkout finishes successfully
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const taskId = session.metadata?.taskId;

      if (taskId) {
        const task = await Task.findByPk(taskId);
        if (task && !task.paidAt) {
          task.paidAt = new Date();
          task.stripePaymentIntentId = session.payment_intent || task.stripePaymentIntentId || null;
          await task.save();
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
