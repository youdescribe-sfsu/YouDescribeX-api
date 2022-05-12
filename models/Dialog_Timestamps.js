const Sequelize = require("sequelize");
const db = require("../config/db");
const Video = require("./Video");

const Dialog_Timestamps = db.define("Dialog_Timestamps", {
  dialog_id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  dialog_sequence_num: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  dialog_start_time: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
  dialog_end_time: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
  dialog_duration: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
});

//Associations
Dialog_Timestamps.belongsTo(Video);

module.exports = Dialog_Timestamps;
