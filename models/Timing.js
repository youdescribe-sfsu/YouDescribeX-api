const { UUIDV4 } = require('sequelize');
const Sequelize = require('sequelize');
const db = require('../config/db');
const Participants = require('./Participants');


const Timing = db.define('Timing', {
  total_time: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
  youtube_video_id: {
    allowNull: false,
    type: Sequelize.STRING,
  },
});

Timing.belongsTo(Participants);

module.exports = Timing;
