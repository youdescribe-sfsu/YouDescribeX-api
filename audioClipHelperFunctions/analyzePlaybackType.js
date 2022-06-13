const Audio_Clips = require('../models/Audio_Clips');
const Dialog_Timestamps = require('../models/Dialog_Timestamps');
const { Op } = require('sequelize');

// analyze clip playback type from dialog timestamp data
const analyzePlaybackType = async (clipStartTime, clipEndTime, videoId) => {
  return await Dialog_Timestamps.findAll({
    //   executes the following condition
    // WHERE ("dialog_start_time" <= clipStartTime
    // AND "dialog_end_time" >= clipEndTime)
    // AND "VideoVideoId" =  videoId;
    where: {
      VideoVideoId: videoId,
      [Op.and]: [
        {
          dialog_start_time: {
            [Op.lte]: [clipEndTime],
          },
        },
        {
          dialog_end_time: {
            [Op.gte]: [clipStartTime],
          },
        },
      ],
    },
    attributes: ['dialog_start_time', 'dialog_end_time'],
  })
    .then((dialog) => {
      if (dialog.length === 0) {
        return {
          message: 'Success!',
          data: 'inline',
        };
      } else {
        return {
          message: 'Success!',
          data: 'extended',
        };
      }
    })
    .catch((err) => {
      console.log(err);
      return {
        message:
          'Unable to connect to DB - Analyze Playback Type!! Please try again',
        data: null,
      }; // send error message
    });
};

module.exports = analyzePlaybackType;
