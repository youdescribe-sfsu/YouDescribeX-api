const mongoDb = require('../../config/db');
const mongoose = require('mongoose');
const Users_Schema = mongoDb.Schema({
    user_id: {
        type: mongoose.Types.ObjectId,
        default: mongoose.Types.ObjectId,
        required: [true],
        unique: true,
    },
    is_ai: {
        type: Boolean,
        required: [true],
    },
    name:{
        type: String,
        required: [true],
    },
    user_email:{
        type: String
    }
});
const Users_Mongo = mongoDb.model('Users', Users_Schema);

module.exports = Users_Mongo;