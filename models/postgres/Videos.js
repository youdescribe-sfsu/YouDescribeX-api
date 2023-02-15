const Sequelize = require('sequelize');
const db = require('../../config/db');

const Videos = db.sequelize.define('Videos', {
  video_id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
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
    type: Sequelize.FLOAT,
  },
});

module.exports = Videos;
