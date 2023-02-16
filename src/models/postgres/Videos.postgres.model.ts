import { getPostGresConnection } from '../../databases';
import { Sequelize, Model, DataTypes } from 'sequelize';
import { IVideos } from '../../interfaces/videos.interface';
import { ObjectId } from 'mongoose';

class Videos extends Model<IVideos> implements IVideos {
  video_id!: ObjectId;
  video_name!: string;
  video_length!: DataTypes.FloatDataType;
  youtube_video_id!: string;
}

function initVideosModel(sequelize: Sequelize) {
  Videos.init(
    {
      video_id: {
        type: DataTypes.UUIDV4,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      youtube_video_id: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      video_name: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      video_length: {
        allowNull: false,
        type: DataTypes.FLOAT,
      },
    },
    {
      sequelize,
      modelName: 'Videos',
    }
  );
  return Videos;
}

export const VideosSchema = initVideosModel(getPostGresConnection());


// const Sequelize = require('sequelize');
// const db = require('../../config/db');

// const Videos = db.sequelize.define('Videos', {
//   video_id: {
//     type: Sequelize.UUID,
//     defaultValue: Sequelize.UUIDV4,
//     allowNull: false,
//     primaryKey: true,
//   },
//   youtube_video_id: {
//     allowNull: false,
//     type: Sequelize.STRING,
//   },
//   video_name: {
//     allowNull: false,
//     type: Sequelize.STRING,
//   },
//   video_length: {
//     allowNull: false,
//     type: Sequelize.FLOAT,
//   },
// });

// module.exports = Videos;
