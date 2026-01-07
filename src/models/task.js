module.exports = (sequelize, DataTypes) => {
  const Task = sequelize.define(
    "Task",
    {
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      category: DataTypes.STRING,

      // ✅ Worker earnings (in cents)
      price_cents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      // ✅ Platform fee (in cents)
      fee_cents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      // ✅ Total user pays (in cents)
      total_cents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      status: {
        type: DataTypes.ENUM(
          "requested",
          "assigned",
          "in_progress",
          "completed",
          "cancelled"
        ),
        defaultValue: "requested",
      },

      lat: DataTypes.FLOAT,
      lng: DataTypes.FLOAT,
      address: DataTypes.STRING,

      stripePaymentIntentId: DataTypes.STRING,
      paidAt: DataTypes.DATE,

      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      workerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {}
  );

  Task.associate = function (models) {
    Task.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Task.belongsTo(models.User, { foreignKey: "workerId", as: "worker" });
    Task.hasOne(models.Transaction, { foreignKey: "taskId", as: "transaction" });
  };

  return Task;
};
