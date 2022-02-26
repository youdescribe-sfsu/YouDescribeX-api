const Sequelize = require('sequelize');
const db = require('../db');

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

module.exports = Video;
