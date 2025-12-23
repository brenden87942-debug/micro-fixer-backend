const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { Task, Transaction } = require('../models');
const { authenticate } = require('../middleware/authenticate');

const stripe = Stripe(process.env.STRIPE_SECRET || '');

router.post('/create-intent', authenticate, async (req,res) => {
  const { taskId } = req.body;
  try {
    const task = await Task.findByPk(taskId);
    if (!task || task.userId !== req.user.id) {
      return res.status(404).json({ ok:false, error:'Task not found' });
    }
    if (!task.price_cents) {
      return res.status(400).json({ ok:false, error:'Task price not set' });
    }

    const platformFee = Math.round(task.price_cents * 0.30);
    const workerAmount = task.price_cents - platformFee;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: task.price_cents,
      currency: 'usd',
      metadata: { taskId: String(task.id), userId: String(req.user.id) }
    });

    task.stripePaymentIntentId = paymentIntent.id;
    await task.save();

    await Transaction.create({
      stripePaymentIntentId: paymentIntent.id,
      amount_cents: task.price_cents,
      platform_fee_cents: platformFee,
      worker_amount_cents: workerAmount,
      status: paymentIntent.status,
      taskId: task.id,
      userId: req.user.id,
      workerId: task.workerId || null
    });

    res.json({ ok:true, clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'Stripe error' });
  }
});

module.exports = router;
