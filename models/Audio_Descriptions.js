const Sequelize = require('sequelize');
const db = require('../db');

const Audio_Descriptions = db.define('Audio_Descriptions', {
  ad_id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  ad_sequence_num: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  is_published: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
});

module.exports = Audio_Descriptions;
