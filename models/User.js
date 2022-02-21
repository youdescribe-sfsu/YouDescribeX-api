const Sequelize = require('sequelize');
const db = require('./db');

const User = db.define('user', {
  user_id: {
    type: Sequelize.INTEGER(11),
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  user_type: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  first_name: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  last_name: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  user_email: {
    allowNull: false,
    type: Sequelize.STRING,
  },
});

module.exports = User;
