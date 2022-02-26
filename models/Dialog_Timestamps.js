const Sequelize = require('sequelize');
const db = require('../db');

const Dialog_Timestamps = db.define('Dialog_Timestamps', {
  dialog_id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  dialog_sequence_num: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  dialog_start_time: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  dialog_end_time: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  dialog_duration: {
    allowNull: false,
    type: Sequelize.STRING,
  },
});

module.exports = Dialog_Timestamps;
