const express = require('express');
const router = express.Router();
const { User, Task, Transaction } = require('../models');

router.get('/stats', async (req,res) => {
  const users = await User.count();
  const workers = await User.count({ where:{ role:'worker' } });
  const tasks = await Task.count();
  const completed = await Task.count({ where:{ status:'completed' } });
  const txs = await Transaction.count();
  res.json({ ok:true, stats:{ users, workers, tasks, completed, transactions:txs } });
});

module.exports = router;
