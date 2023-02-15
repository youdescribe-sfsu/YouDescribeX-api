const mongoDb = require('../../config/db');
const mongoose = require('mongoose');
const Dialog_TimeStamps_Schema = mongoDb.Schema({
    dialog_id: {
        type: String,
        default: mongoose.Types.ObjectId,
        required: [true],
        unique: true,
    },
    dialog_sequence_num:{
        type: Number,
        required: [true],
    },
    dialog_start_time: {
        type: Number,
        required: [true],
    },
    dialog_end_time: {
        type: Number,
        required: [true],
    },
    dialog_duration: {
        type: Number,
        required: [true],
    }
});
const Dialog_TimeStamps_Mongo = mongoDb.model('Dialog_TimeStamp', Dialog_TimeStamps_Schema);

module.exports = Dialog_TimeStamps_Mongo;