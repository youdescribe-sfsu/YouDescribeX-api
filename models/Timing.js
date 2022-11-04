const { UUIDV4 } = require('sequelize');
const Sequelize = require('sequelize');
const db = require('../config/db');
const Participants = require('./Participants');


const Timing = db.define('Timing', {
  total_time: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
});

Timing.belongsTo(Participants);

module.exports = Timing;
