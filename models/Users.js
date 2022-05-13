const { UUIDV4 } = require('sequelize');
const Sequelize = require('sequelize');
const db = require('../config/db');

const Users = db.define('Users', {
  user_id: {
    type: Sequelize.UUID,
    defaultValue: UUIDV4,
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

module.exports = Users;
