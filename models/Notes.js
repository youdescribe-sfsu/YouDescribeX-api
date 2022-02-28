const Sequelize = require('sequelize');
const db = require('../config/db');

const Notes = db.define('Notes', {
  notes_id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  notes_text: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  notes_timestamp: {
    allowNull: false,
    type: Sequelize.STRING,
  },
});

module.exports = Notes;
