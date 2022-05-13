const Sequelize = require('sequelize');
const db = require('../config/db');
const Audio_Clips = require('./Audio_Clips');
const Users = require('./Users');
const Videos = require('./Videos');

const Audio_Descriptions = db.define('Audio_Descriptions', {
  ad_id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  is_published: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
});

//Associations
Audio_Descriptions.belongsTo(Users);
Audio_Descriptions.belongsTo(Videos);
Audio_Descriptions.hasMany(Audio_Clips);

module.exports = Audio_Descriptions;
