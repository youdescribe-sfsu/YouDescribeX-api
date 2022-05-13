const Sequelize = require('sequelize');
const db = require('../config/db');

const Audio_Clips = db.define('Audio_Clips', {
  clip_id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  clip_title: {
    allowNull: true,
    type: Sequelize.STRING,
  },
  description_type: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  description_text: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  playback_type: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  clip_start_time: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
  clip_end_time: {
    allowNull: true,
    type: Sequelize.FLOAT,
  },
  clip_duration: {
    allowNull: true,
    type: Sequelize.FLOAT,
  },
  clip_audio_path: {
    allowNull: true,
    type: Sequelize.STRING,
  },
  is_recorded: {
    allowNull: false,
    defaultValue: false,
    type: Sequelize.BOOLEAN,
  },
});

//Associations

module.exports = Audio_Clips;
