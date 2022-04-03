const Dialog_Timestamps = require('../models/Dialog_Timestamps');

// db processing is done here using sequelize models

// find all Dialog_Timestamps
exports.getAllDialogTimestamps = async (req, res) => {
  Dialog_Timestamps.findAll()
    .then((allDialogTimestampss) => {
      console.log(allDialogTimestampss);
      return res.send(allDialogTimestampss);
    })
    .catch((err) => console.log(err));
};

// find one Dialog_Timestamps row
exports.getDialogTimestamp = async (req, res) => {
  Dialog_Timestamps.findAll({
    where: {
      dialog_id: req.params.dialogId,
    },
  })
    .then((DialogTimestamp) => {
      console.log(DialogTimestamp);
      return res.send(DialogTimestamp);
    })
    .catch((err) => {
      console.log(err);
    });
};

// find the Dialog_Timestamps - based on video_id
exports.getVideoDialogTimestamps = async (req, res) => {
  Dialog_Timestamps.findAll({
    where: {
      VideoVideoId: req.params.videoId,
    },
  })
    .then((VideoDialogTimestamps) => {
      console.log(VideoDialogTimestamps);
      return res.send(VideoDialogTimestamps);
    })
    .catch((err) => {
      console.log(err);
    });
};
