module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    phone: DataTypes.STRING,
    role: { type: DataTypes.STRING, defaultValue: 'user' },
    password_hash: DataTypes.STRING,
    verified: { type: DataTypes.BOOLEAN, defaultValue: false },
    rating: { type: DataTypes.FLOAT, defaultValue: 5.0 },
    stripe_account_id: DataTypes.STRING,
    emailVerifyToken: DataTypes.STRING,
    passwordResetToken: DataTypes.STRING,
    passwordResetExpires: DataTypes.DATE,
    locationLat: DataTypes.FLOAT,
    locationLng: DataTypes.FLOAT,
    skills: DataTypes.STRING
  }, {});
  User.associate = function(models) {
    User.hasMany(models.Task, { foreignKey: 'userId', as: 'tasks' });
    User.hasMany(models.Task, { foreignKey: 'workerId', as: 'assignedTasks' });
    User.hasMany(models.RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' });
    User.hasMany(models.Transaction, { foreignKey: 'userId', as: 'transactions' });
  };
  return User;
};
