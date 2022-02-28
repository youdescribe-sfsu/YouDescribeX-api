const Sequelize = require('sequelize');
const db = require('../config/db');
const Audio_Descriptions = require('./Audio_Descriptions');
const Dialog_Timestamps = require('./Dialog_Timestamps');

const Video = db.define('Video', {
  video_id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  youtube_video_id: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  video_name: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  video_length: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
});

//Associations
Video.belongsToMany(Audio_Descriptions, {
  through: 'video_has_many_ad',
});
Audio_Descriptions.belongsTo(Video, {
  through: 'video_has_many_ad',
});

Video.belongsToMany(Dialog_Timestamps, {
  through: 'video_has_many_timestamps',
});
Dialog_Timestamps.belongsTo(Video, {
  through: 'video_has_many_timestamps',
});

module.exports = Video;
