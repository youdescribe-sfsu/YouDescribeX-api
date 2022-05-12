const Sequelize = require("sequelize");
const db = require("../config/db");

const Audio_Clips = db.define("Audio_Clips", {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  title: {
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
  start_time: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
  end_time: {
    allowNull: true,
    type: Sequelize.FLOAT,
  },
  duration: {
    allowNull: true,
    type: Sequelize.FLOAT,
  },
  audio_path: {
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
