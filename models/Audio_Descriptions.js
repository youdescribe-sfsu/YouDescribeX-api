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
  ad_sequence_num: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  is_published: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
});

//Associations
Audio_Descriptions.belongsTo(User, {
  through: 'audiodesc_user_relation',
});
Audio_Descriptions.belongsTo(Video, {
  through: 'audiodesc_video_relation',
});

module.exports = Audio_Descriptions;
