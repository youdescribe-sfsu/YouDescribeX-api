const Sequelize = require("sequelize");
const db = require("../config/db");

const Video = db.define("Video", {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true,
  },
  youtube_id: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  name: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  length: {
    allowNull: false,
    type: Sequelize.FLOAT,
  },
});

module.exports = Video;
