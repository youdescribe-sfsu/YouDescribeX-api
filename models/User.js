const Sequelize = require('sequelize');
const db = require('../db');
const Audio_Descriptions = require('./Audio_Descriptions');

const User = db.define('User', {
  user_id: {
    type: Sequelize.INTEGER,
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

//Associations
User.belongsToMany(Audio_Descriptions, {
  through: 'user_has_many_ad',
});
Audio_Descriptions.belongsTo(User, {
  through: 'user_has_many_ad',
});

module.exports = User;
