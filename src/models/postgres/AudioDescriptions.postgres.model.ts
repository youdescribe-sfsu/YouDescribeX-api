import { getPostGresConnection } from '../../databases';
import { Sequelize, Model, DataTypes } from 'sequelize';
import { UsersSchema } from './Users.postgres.model';
import { VideosSchema } from './Videos.postgres.model';
import { IAudioDescriptions } from '../../interfaces/audioDescriptions.interface';
import { ObjectId } from 'mongoose';

class AudioDescriptions extends Model<IAudioDescriptions> implements IAudioDescriptions {
    ad_id: ObjectId;
    is_published: boolean;
}

function initAudioDescriptionsModel(sequelize: Sequelize) {
    AudioDescriptions.init(
        {
            ad_id: {
                type: DataTypes.UUIDV4,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
            },
            is_published: {
                allowNull: false,
                type: DataTypes.BOOLEAN,
            },
        },
        {
            sequelize,
            modelName: 'Audio_Descriptions',
        },
    );
    AudioDescriptions.belongsTo(VideosSchema);
    AudioDescriptions.belongsTo(UsersSchema)
    return AudioDescriptions
}

export const AudioDescriptionsSchema = initAudioDescriptionsModel(getPostGresConnection());


// const Sequelize = require('sequelize');
// const db = require('../config/db');
// const Users = require('./Users');
// const Videos = require('./Videos');

// const Audio_Descriptions = db.define('Audio_Descriptions', {
//   ad_id: {
//     type: Sequelize.UUID,
//     defaultValue: Sequelize.UUIDV4,
//     allowNull: false,
//     primaryKey: true,
//   },
//   is_published: {
//     allowNull: false,
//     type: Sequelize.BOOLEAN,
//   },
// });

// //Associations
// Audio_Descriptions.belongsTo(Users);
// Audio_Descriptions.belongsTo(Videos);

// module.exports = Audio_Descriptions;
