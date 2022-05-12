const { UUIDV4 } = require("sequelize");
const Sequelize = require("sequelize");
const db = require("../config/db");

const User = db.define("User", {
  user_id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  is_ai: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
  name: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  user_email: {
    allowNull: true,
    type: Sequelize.STRING,
  },
});

module.exports = User;
