const currentDB = process.env.CURRENT_DB || 'postgres'
const Videos = require('../../models/postgres/Videos');
const Videos_Mongo = require('../../models/mongodb/Videos_mongo');


exports.getVideobyYoutubeIdUtil = async (youtube_video_id) => {
    if(currentDB === 'postgres') {
        return await Videos.findOne({
            where: {
                youtube_video_id: youtube_video_id,
            },
        });
    } else if(currentDB === 'mongodb') {
        return await Videos_Mongo.findOne({
            youtube_video_id: youtube_video_id,
        });
    }
}