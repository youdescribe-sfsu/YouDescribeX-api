const Sequelize = require('sequelize');
const db = require('../config/db');
const Notes = require('./Notes');
const Audio_Clips = require('./Audio_Clips');

const Audio_Descriptions = db.define('Audio_Descriptions', {
  ad_id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },
  ad_sequence_num: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  is_published: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
});

//Associations
Audio_Descriptions.belongsToMany(Notes, {
  through: 'ad_has_many_notes',
});
Notes.belongsTo(Audio_Descriptions, {
  through: 'ad_has_many_notes',
});

Audio_Descriptions.belongsToMany(Audio_Clips, {
  through: 'ad_has_many_audioClips',
});
Audio_Clips.belongsTo(Audio_Descriptions, {
  through: 'ad_has_many_audioClips',
});

module.exports = Audio_Descriptions;
