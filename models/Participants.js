const { UUIDV4 } = require('sequelize');
const Sequelize = require('sequelize');
const db = require('../config/db');

const Participants = db.define('Participants', {
  participant_id: {
    type: Sequelize.UUID,
    defaultValue: UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  participant_name: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  participant_email: {
    allowNull: true,
    type: Sequelize.STRING,
  },
  youtube_video_id: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  user_id_with_AI: {
    allowNull: false,
    type: Sequelize.UUID,
  },
  user_id_without_AI: {
    allowNull: false,
    type: Sequelize.UUID,
  },
});

module.exports = Participants;
