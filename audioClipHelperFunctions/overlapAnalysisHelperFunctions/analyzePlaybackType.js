const Audio_Clips = require('../../models/Audio_Clips');
const Dialog_Timestamps = require('../../models/Dialog_Timestamps');
const { Op } = require('sequelize');

// analyze clip playback type from dialog timestamp data
const analyzePlaybackType = async (
  currentClipStartTime,
  currentClipEndTime,
  videoId,
  adId,
  clipId
) => {
  return await Dialog_Timestamps.findAll({
    // executes the following condition
    // WHERE ("dialog_start_time" <= currentClipEndTime
    // AND "dialog_end_time" >= currentClipStartTime)
    // AND "VideoVideoId" =  videoId;
    // logging: false,
    where: {
      VideoVideoId: videoId,
      [Op.and]: [
        {
          dialog_start_time: {
            [Op.lte]: [currentClipEndTime],
          },
        },
        {
          dialog_end_time: {
            [Op.gte]: [currentClipStartTime],
          },
        },
      ],
    },
    attributes: ['dialog_start_time', 'dialog_end_time'],
  })
    .then(async (overlappingDialogs) => {
      if (overlappingDialogs.length !== 0) {
        return {
          message: 'Success - extended!',
          data: 'extended',
        };
      } else {
        return await Audio_Clips.findAll({
          // if clipId is null - In the case of new audio clip
          // executes the following condition
          // WHERE ("clip_start_time" <= currentClipEndTime AND
          // "clip_end_time" >= currentClipStartTime AND "clip_id"
          // IS NOT NULL) AND "AudioDescriptionAdId" = adId;

          // if clipId is passed to this method - In the case of updating existing audio clip
          // WHERE ("clip_start_time" <= currentClipEndTime AND
          // "clip_end_time" >= currentClipStartTime AND "clip_id"
          // NOT IN (clipId))
          // AND "Audio_Clips"."AudioDescriptionAdId" = adId;
          // logging: false,
          where: {
            AudioDescriptionAdId: adId,
            [Op.and]: [
              {
                clip_start_time: {
                  [Op.lte]: [currentClipEndTime],
                },
              },
              {
                clip_end_time: {
                  [Op.gte]: [currentClipStartTime],
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
          raw: true, // get only data values from the db
        })
          .then((overlappingClips) => {
            if (overlappingClips.length === 0) {
              return {
                message: 'Success - inline!',
                data: 'inline',
              };
            } else {
              // checking if there are overlapping clips after the current clip,
              // if yes mark it as extended, if no mark it as inline
              let countOfClipsAfter = 0;
              overlappingClips.forEach((clip) => {
                // check by comparing start times
                if (clip.clip_start_time > currentClipStartTime) {
                  console.log('************ GREATER ********');
                  console.log(currentClipStartTime);
                  console.log(clip.clip_start_time);
                  countOfClipsAfter++;
                } else {
                  console.log('************ LESSER ********');
                  console.log(currentClipStartTime);
                  console.log(clip.clip_start_time);
                }
              });
              console.log(countOfClipsAfter);
              if (countOfClipsAfter > 0) {
                return {
                  message: 'Success - extended!',
                  data: 'extended',
                };
              } else {
                return {
                  message: 'Success - inline!',
                  data: 'inline',
                };
              }
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
