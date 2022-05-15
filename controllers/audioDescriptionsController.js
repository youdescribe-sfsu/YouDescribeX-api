const Audio_Descriptions = require('../models/Audio_Descriptions');
const Audio_Clips = require('../models/Audio_Clips');
const Notes = require('../models/Notes');

// db processing is done here using sequelize models

// GET Routes
// get user Audio Description Data (including Notes, AudioClips) - based on UserId & VideoId
exports.getUserAudioDescriptionData = async (req, res) => {
  Audio_Descriptions.findOne({
    where: {
      VideoVideoId: req.params.videoId,
      UserUserId: req.params.userId,
    },
    // nesting Audio_Clips & Notes data too
    include: [
      {
        model: Audio_Clips,
        separate: true, // this is nested data, so ordering works only with separate true
        order: ['clip_start_time'],
      },
      {
        model: Notes,
      },
    ],
  })
    .then((data) => {
      // console.log(data);
      return res.send(data);
    })
    .catch((err) => {
      console.log(err);
    });
};
