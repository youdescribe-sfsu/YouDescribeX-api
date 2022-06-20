const Audio_Clips = require('../models/Audio_Clips');
const Dialog_Timestamps = require('../models/Dialog_Timestamps');
const { Op } = require('sequelize');

// analyze clip playback type from dialog timestamp data
const analyzePlaybackType = async (
  clipStartTime,
  clipEndTime,
  videoId,
  adId,
  clipId
) => {
  return await Dialog_Timestamps.findAll({
    //   executes the following condition
    // WHERE ("dialog_start_time" <= clipEndTime
    // AND "dialog_end_time" >= clipStartTime)
    // AND "VideoVideoId" =  videoId;
    // logging: false,
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
    .then(async (dialog) => {
      if (dialog.length !== 0) {
        return {
          message: 'Success!',
          data: 'extended',
        };
      } else {
        return await Audio_Clips.findAll({
          // if clipId is null - In the case of new audio clip
          // executes the following condition
          // WHERE ("clip_start_time" <= clipEndTime AND
          // "clip_end_time" >= clipStartTime AND "clip_id"
          // IS NOT NULL) AND "AudioDescriptionAdId" = adId;

          // if clipId is passed to this method - In the case of updating existing audio clip
          // WHERE ("clip_start_time" <= clipEndTime AND
          // "clip_end_time" >= clipStartTime AND "clip_id"
          // NOT IN (clipId))
          // AND "Audio_Clips"."AudioDescriptionAdId" = adId;
          // logging: false,
          where: {
            AudioDescriptionAdId: adId,
            [Op.and]: [
              {
                clip_start_time: {
                  [Op.lte]: [clipEndTime],
                },
              },
              {
                clip_end_time: {
                  [Op.gte]: [clipStartTime],
                },
              },
              {
                clip_id: {
                  [Op.not]: clipId === null ? null : [clipId],
                },
              },
            ],
          },
        })
          .then((overlappingClip) => {
            if (overlappingClip.length === 0) {
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
