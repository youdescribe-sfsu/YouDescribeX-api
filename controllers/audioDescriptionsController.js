const Audio_Descriptions = require('../models/Audio_Descriptions');

// db processing is done here using sequelize models
// find all Audio_Descriptions
exports.getAllAudioDescriptions = async (req, res) => {
  Audio_Descriptions.findAll()
    .then((allAudioDescriptions) => {
      console.log(allAudioDescriptions);
      return res.send(allAudioDescriptions);
    })
    .catch((err) => console.log(err));
};

// find one Audio_Descriptions row - based on id
exports.getAudioDescription = async (req, res) => {
  Audio_Descriptions.findAll({
    where: {
      ad_id: req.params.adId,
    },
  })
    .then((AudioDescription) => {
      console.log(AudioDescription);
      return res.send(AudioDescription);
    })
    .catch((err) => {
      console.log(err);
    });
};

// find the Audio_Descriptions - based on video_id & user_id
exports.getUserAudioDescription = async (req, res) => {
  Audio_Descriptions.findAll({
    where: {
      VideoVideoId: req.params.videoId,
      UserUserId: req.params.userId,
    },
  })
    .then((UserAudioDescription) => {
      console.log(UserAudioDescription);
      return res.send(UserAudioDescription);
    })
    .catch((err) => {
      console.log(err);
    });
};
