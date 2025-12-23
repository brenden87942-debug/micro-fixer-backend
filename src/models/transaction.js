module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    stripePaymentIntentId: DataTypes.STRING,
    amount_cents: DataTypes.INTEGER,
    platform_fee_cents: DataTypes.INTEGER,
    worker_amount_cents: DataTypes.INTEGER,
    status: DataTypes.STRING
  }, {});
  Transaction.associate = function(models) {
    Transaction.belongsTo(models.Task, { foreignKey: 'taskId', as: 'task' });
    Transaction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Transaction.belongsTo(models.User, { foreignKey: 'workerId', as: 'worker' });
  };
  return Transaction;
};
