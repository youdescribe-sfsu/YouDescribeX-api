const Dialog_Timestamps = require('../models/Dialog_Timestamps');

// db processing is done here using sequelize models
// find the Dialog_Timestamps - based on video_id
exports.getVideoDialogTimestamps = async (req, res) => {
  Dialog_Timestamps.findAll({
    where: {
      VideoVideoId: req.params.videoId,
    },
  })
    .then((VideoDialogTimestamps) => {
      // console.log(VideoDialogTimestamps);
      return res.status(200).send(VideoDialogTimestamps);
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send(err.message);
    });
};
