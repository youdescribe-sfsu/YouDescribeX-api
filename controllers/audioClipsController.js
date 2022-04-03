const Audio_Clips = require('../models/Audio_Clips');

// db processing is done here using sequelize models
// find all Audio_Clips
exports.getAllAudioClips = async (req, res) => {
  Audio_Clips.findAll()
    .then((allAudioClips) => {
      console.log(allAudioClips);
      return res.send(allAudioClips);
    })
    .catch((err) => console.log(err));
};

// find one Audio_Clips row - based on id
exports.getAudioClip = async (req, res) => {
  Audio_Clips.findAll({
    where: {
      clip_id: req.params.clipId,
    },
  })
    .then((AudioClip) => {
      console.log(AudioClip);
      return res.send(AudioClip);
    })
    .catch((err) => {
      console.log(err);
    });
};

// find the Audio_Clips - based on ad_id
exports.getADAudioClips = async (req, res) => {
  Audio_Clips.findAll({
    where: {
      AudioDescriptionAdId: req.params.adId,
    },
  })
    .then((ADAudioClips) => {
      console.log(ADAudioClips);
      return res.send(ADAudioClips);
    })
    .catch((err) => {
      console.log(err);
    });
};
