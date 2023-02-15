const mongoDb = require('../../config/db');
const mongoose = require('mongoose');

const Audio_Descriptions_Schema = mongoDb.Schema({
    ad_id: {
        type: mongoose.Types.ObjectId,
        defaultValue: mongoose.Types.ObjectId,
        required: [true],
        unique: true,
    },
    is_published: {
        required: [true],
        type: Boolean,
    },
});
const Audio_Descriptions_Mongo = mongoDb.model('Audio_Descriptions', Audio_Descriptions_Schema);

module.exports = Audio_Descriptions_Mongo;