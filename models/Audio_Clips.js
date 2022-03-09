const Sequelize = require('sequelize');
const db = require('../config/db');
const Audio_Descriptions = require('./Audio_Descriptions');

const Audio_Clips = db.define('Audio_Clips', {
  clip_id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  clip_sequence_num: {
    allowNull: false,
    type: Sequelize.INTEGER,
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
    type: Sequelize.STRING,
  },
  clip_end_time: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  clip_duration: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  clip_audio_path: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  is_recorded: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
  recorded_audio_path: {
    allowNull: false,
    type: Sequelize.STRING,
  },
});

//Associations
Audio_Clips.belongsTo(Audio_Descriptions, {
  through: 'audiodesc_audioclips_relation',
});

module.exports = Audio_Clips;
