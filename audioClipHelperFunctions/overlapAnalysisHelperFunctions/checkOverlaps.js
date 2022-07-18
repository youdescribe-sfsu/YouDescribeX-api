const Audio_Clips = require('../../models/Audio_Clips');
const Dialog_Timestamps = require('../../models/Dialog_Timestamps');
const { Op } = require('sequelize');

const checkOverlaps = async (
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
    logging: false,
  })
    .then(async (dialog) => {
      // overlaps exist - return true
      if (dialog.length !== 0) {
        return {
          message: dialog,
          data: {
            clipStartTime,
            clipEndTime,
            overlaps: true,
          },
        };
      }
      // no overlaps - check for overlaps in audio clips
      else {
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
                  // Not considering the clipId that you want to insert/update
                  [Op.not]: clipId === null ? null : [clipId],
                },
              },
            ],
          },
          attributes: ['clip_id', 'clip_start_time', 'clip_end_time'],
          logging: false,
        })
          .then((overlappingClips) => {
            // no overlaps - return false
            if (overlappingClips.length === 0) {
              return {
                message: 'No Overlaps',
                data: {
                  clipStartTime,
                  clipEndTime,
                  overlaps: false,
                },
              };
            }
            // overlaps exist - return true
            else {
              return {
                message: overlappingClips,
                data: {
                  clipStartTime,
                  clipEndTime,
                  overlaps: true,
                },
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

module.exports = checkOverlaps;
