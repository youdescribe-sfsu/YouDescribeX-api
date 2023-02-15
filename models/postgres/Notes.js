const Sequelize = require('sequelize');
const db = require('../config/db');
const Audio_Descriptions = require('./Audio_Descriptions');

const Notes = db.define('Notes', {
  notes_id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  notes_text: {
    allowNull: false,
    type: Sequelize.TEXT,
  },
});

//Associations
Notes.belongsTo(Audio_Descriptions);
Audio_Descriptions.hasMany(Notes);

module.exports = Notes;
