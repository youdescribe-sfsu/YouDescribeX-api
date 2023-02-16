import { getPostGresConnection } from '../../databases';
import { Sequelize, Model, DataTypes } from 'sequelize';
import { AudioDescriptionsSchema } from './AudioDescriptions.postgres.model';
import { IAudioClips } from '../../interfaces/audioClips.interface';
import { ObjectId } from 'mongoose';

class AudioClips extends Model<IAudioClips> implements IAudioClips {
  public clip_id!: ObjectId;
  public clip_title!: string | null;
  public description_type!: string;
  public description_text!: string;
  public playback_type!: string;
  public clip_start_time!: DataTypes.FloatDataType;
  public clip_end_time!: DataTypes.FloatDataType;
  public clip_duration!: DataTypes.FloatDataType;
  public clip_audio_path!: string;
  public is_recorded!: boolean;
}

function initAudioClipsModel(sequelize: Sequelize) {
  AudioClips.init(
    {
      clip_id: {
        type: DataTypes.UUIDV4,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      clip_title: {
        allowNull: true,
        type: DataTypes.STRING,
      },
      description_type: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      description_text: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      playback_type: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      clip_start_time: {
        allowNull: false,
        type: DataTypes.FLOAT,
      },
      clip_end_time: {
        allowNull: true,
        type: DataTypes.FLOAT,
      },
      clip_duration: {
        allowNull: true,
        type: DataTypes.FLOAT,
      },
      clip_audio_path: {
        allowNull: true,
        type: DataTypes.STRING,
      },
      is_recorded: {
        allowNull: false,
        defaultValue: false,
        type: DataTypes.BOOLEAN,
      },
    },
    {
      sequelize,
      modelName: 'Audio_Descriptions',
    },
  );
  AudioClips.belongsTo(AudioDescriptionsSchema);
  AudioDescriptionsSchema.hasMany(AudioClips);
  return AudioClips
}

export const AudioClipsSchema = initAudioClipsModel(getPostGresConnection());

// const Sequelize = require('sequelize');
// const db = require('../../config/db');
// const Audio_Descriptions = require('./Audio_Descriptions');

// const Audio_Clips = db.define('Audio_Clips', {
//   clip_id: {
//     type: Sequelize.UUID,
//     defaultValue: Sequelize.UUIDV4,
//     allowNull: false,
//     primaryKey: true,
//   },
//   clip_title: {
//     allowNull: true,
//     type: Sequelize.STRING,
//   },
//   description_type: {
//     allowNull: false,
//     type: Sequelize.STRING,
//   },
//   description_text: {
//     allowNull: false,
//     type: Sequelize.STRING,
//   },
//   playback_type: {
//     allowNull: false,
//     type: Sequelize.STRING,
//   },
//   clip_start_time: {
//     allowNull: false,
//     type: Sequelize.FLOAT,
//   },
//   clip_end_time: {
//     allowNull: true,
//     type: Sequelize.FLOAT,
//   },
//   clip_duration: {
//     allowNull: true,
//     type: Sequelize.FLOAT,
//   },
//   clip_audio_path: {
//     allowNull: true,
//     type: Sequelize.STRING,
//   },
//   is_recorded: {
//     allowNull: false,
//     defaultValue: false,
//     type: Sequelize.BOOLEAN,
//   },
// });

// //Associations
// Audio_Clips.belongsTo(Audio_Descriptions);
// Audio_Descriptions.hasMany(Audio_Clips);

// module.exports = Audio_Clips;
