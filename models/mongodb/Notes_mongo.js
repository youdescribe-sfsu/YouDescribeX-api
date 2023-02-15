const mongoDb = require('../../config/db');
const mongoose = require('mongoose');
const Notes_Schema = mongoDb.Schema({
    notes_id: {
        type: mongoose.Types.ObjectId,
        default: mongoose.Types.ObjectId,
        required: [true],
        unique: true,
    },
    notes_text: {
        type: String,
        required: [true],
    }
});
const Notes_Mongo = mongoDb.model('Notes', Notes_Schema);

module.exports = Notes_Mongo;