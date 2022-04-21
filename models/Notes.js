const Sequelize = require('sequelize');
const db = require('../config/db');
const Audio_Descriptions = require('./Audio_Descriptions');

const Notes = db.define('Notes', {
  notes_id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  notes_text: {
    allowNull: false,
    type: Sequelize.STRING(1000),
  },
  // notes_timestamp: {
  //   allowNull: false,
  //   type: Sequelize.STRING,
  // },
});

//Associations
Notes.belongsTo(Audio_Descriptions);

module.exports = Notes;
