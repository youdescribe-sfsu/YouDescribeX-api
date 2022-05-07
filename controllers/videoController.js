const Videos = require('../models/Videos');

// db processing is done here using sequelize models

// find all Videos
exports.getAllVideos = async (req, res) => {
  Videos.findAll()
    .then((allVideos) => {
      console.log(allVideos);
      return res.send(allVideos);
    })
    .catch((err) => console.log(err));
};

// find one Video
exports.getVideo = async (req, res) => {
  Videos.findAll({
    where: {
      video_id: req.params.id,
    },
  })
    .then((videos) => {
      console.log(videos);
      return res.send(videos);
    })
    .catch((err) => {
      console.log(err);
    });
};

// find one Video by YouTubeVideoId
exports.getVideobyYoutubeId = async (req, res) => {
  Videos.findOne({
    where: {
      youtube_video_id: req.params.youtubeId,
    },
  })
    .then((videos) => {
      console.log(videos);
      return res.send(videos);
    })
    .catch((err) => {
      console.log(err);
    });
};
