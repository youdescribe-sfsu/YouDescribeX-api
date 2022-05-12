const Sequelize = require("sequelize");
const db = require("../config/db");
const Audio_Clips = require("./Audio_Clips");
const User = require("./User");
const Video = require("./Video");

const Audio_Descriptions = db.define("Audio_Descriptions", {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,

    primaryKey: true,
  },
  is_published: {
    allowNull: false,
    type: Sequelize.BOOLEAN,
  },
});

//Associations
Audio_Descriptions.belongsTo(User);
Audio_Descriptions.belongsTo(Video);
Audio_Descriptions.hasMany(Audio_Clips);

module.exports = Audio_Descriptions;
