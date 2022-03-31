const Video = require('../models/Video');

// db processing is done here using sequelize models

// find all Videos
exports.getAllVideos = async (req, res) => {
  Video.findAll()
    .then((allVideos) => {
      console.log(allVideos);
      return res.send(allVideos);
    })
    .catch((err) => console.log(err));
};

// find one Video
exports.getVideo = async (req, res) => {
  Video.findAll({
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
