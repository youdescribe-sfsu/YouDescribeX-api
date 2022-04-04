const Sequelize = require('sequelize');
const db = require('../config/db');
const User = require('./User');
const Video = require('./Video');

const Audio_Descriptions = db.define('Audio_Descriptions', {
  ad_id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  is_published: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
});

//Associations
Audio_Descriptions.belongsTo(User);
Audio_Descriptions.belongsTo(Video);

module.exports = Audio_Descriptions;
