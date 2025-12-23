module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    token: { type: DataTypes.STRING, unique: true },
    expiresAt: DataTypes.DATE,
    revoked: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {});
  RefreshToken.associate = function(models) {
    RefreshToken.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };
  return RefreshToken;
};
