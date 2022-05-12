const Sequelize = require("sequelize");
const db = require("../config/db");
const Video = require("./Video");

const Dialog_Timestamps = db.define("Dialog_Timestamps", {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    allowNull: false,
    primaryKey: true,
  },
  sequence_num: {
    allowNull: false,
    type: Sequelize.INTEGER,
  },
  start_time: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
  end_time: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
  duration: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
});

//Associations
Dialog_Timestamps.belongsTo(Video);

module.exports = Dialog_Timestamps;
