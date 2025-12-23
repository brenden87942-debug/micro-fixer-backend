'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Users', {
      id: { allowNull:false, autoIncrement:true, primaryKey:true, type:Sequelize.INTEGER },
      name: Sequelize.STRING,
      email: { type: Sequelize.STRING, unique: true },
      phone: Sequelize.STRING,
      role: { type: Sequelize.STRING, defaultValue: 'user' },
      password_hash: Sequelize.STRING,
      verified: { type: Sequelize.BOOLEAN, defaultValue: false },
      rating: { type: Sequelize.FLOAT, defaultValue: 5.0 },
      stripe_account_id: Sequelize.STRING,
      emailVerifyToken: Sequelize.STRING,
      passwordResetToken: Sequelize.STRING,
      passwordResetExpires: Sequelize.DATE,
      locationLat: Sequelize.FLOAT,
      locationLng: Sequelize.FLOAT,
      skills: Sequelize.STRING,
      createdAt: { allowNull:false, type:Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { allowNull:false, type:Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('Tasks', {
      id: { allowNull:false, autoIncrement:true, primaryKey:true, type:Sequelize.INTEGER },
      title: Sequelize.STRING,
      description: Sequelize.TEXT,
      category: Sequelize.STRING,
      price_cents: Sequelize.INTEGER,
      status: {
        type: Sequelize.STRING,
        defaultValue: 'requested'
      },
      lat: Sequelize.FLOAT,
      lng: Sequelize.FLOAT,
      address: Sequelize.STRING,
      stripePaymentIntentId: Sequelize.STRING,
      paidAt: Sequelize.DATE,
      userId: { type:Sequelize.INTEGER, references:{ model:'Users', key:'id' }, onDelete:'CASCADE' },
      workerId: { type:Sequelize.INTEGER, references:{ model:'Users', key:'id' }, onDelete:'SET NULL' },
      createdAt: { allowNull:false, type:Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { allowNull:false, type:Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('RefreshTokens', {
      id: { allowNull:false, autoIncrement:true, primaryKey:true, type:Sequelize.INTEGER },
      token: { type: Sequelize.STRING, unique:true },
      userId: { type:Sequelize.INTEGER, references:{ model:'Users', key:'id' }, onDelete:'CASCADE' },
      expiresAt: Sequelize.DATE,
      revoked: { type:Sequelize.BOOLEAN, defaultValue:false },
      createdAt: { allowNull:false, type:Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { allowNull:false, type:Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });

    await queryInterface.createTable('Transactions', {
      id: { allowNull:false, autoIncrement:true, primaryKey:true, type:Sequelize.INTEGER },
      stripePaymentIntentId: Sequelize.STRING,
      amount_cents: Sequelize.INTEGER,
      platform_fee_cents: Sequelize.INTEGER,
      worker_amount_cents: Sequelize.INTEGER,
      status: Sequelize.STRING,
      taskId: { type:Sequelize.INTEGER, references:{ model:'Tasks', key:'id' }, onDelete:'CASCADE' },
      userId: { type:Sequelize.INTEGER, references:{ model:'Users', key:'id' }, onDelete:'CASCADE' },
      workerId: { type:Sequelize.INTEGER, references:{ model:'Users', key:'id' }, onDelete:'SET NULL' },
      createdAt: { allowNull:false, type:Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { allowNull:false, type:Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Transactions');
    await queryInterface.dropTable('RefreshTokens');
    await queryInterface.dropTable('Tasks');
    await queryInterface.dropTable('Users');
  }
};
