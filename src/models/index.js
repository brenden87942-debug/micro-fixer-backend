"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = require("../../config/config.json")[env];

const db = {};

// ✅ Prefer Railway internal DB URL if available
const dbUrl =
  process.env.DATABASE_PRIVATE_URL ||
  process.env.DATABASE_URL ||
  (config.use_env_variable ? process.env[config.use_env_variable] : null);

let sequelize;

if (env === "production") {
  if (!dbUrl) {
    console.error("FATAL: Missing DATABASE_URL / DATABASE_PRIVATE_URL in production env");
    // still create a sequelize object so app can boot; DB will show as down
    sequelize = new Sequelize("postgres://invalid:invalid@localhost:5432/invalid", {
      dialect: "postgres",
      logging: false,
      dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
    });
  } else {
    sequelize = new Sequelize(dbUrl, {
      dialect: "postgres",
      logging: false,
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
      },
    });
  }
} else {
  // dev/test -> sqlite
  sequelize = new Sequelize({
    dialect: config.dialect,
    storage: config.storage,
    logging: config.logging ?? false,
  });
}

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 &&
      file !== basename &&
      (file.slice(-3) === ".js" || file.slice(-4) === ".mjs")
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) db[modelName].associate(db);
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
