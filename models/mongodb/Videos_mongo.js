const mongoDb = require('../../config/db');
const mongoose = require('mongoose');
const Videos_Schema = mongoDb.Schema({
    video_id: {
        type: mongoose.Types.ObjectId,
        default: mongoose.Types.ObjectId,
        required: [true],
        unique: true,
    },
    video_name: {
        type: String,
        required: [true],
    },
    youtube_video_id: {
        type: String,
        required: [true],
    },
    video_length: {
        type: Number,
        required: [true],
    }
});
const Videos_Mongo = mongoDb.model('Videos', Videos_Schema);

module.exports = Videos_Mongo;