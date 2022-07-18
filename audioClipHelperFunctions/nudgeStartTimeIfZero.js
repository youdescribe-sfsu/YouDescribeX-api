const Audio_Clips = require('../models/Audio_Clips');

// filter the audio clips with start time zero (rounded) & add 1 sec to the start time
const nudgeStartTimeIfZero = async (audioClips) => {
  const startTimeZeroaudioClipIds = [];
  audioClips.forEach((clip) => {
    if (parseInt(clip.clip_start_time) === 0) {
      startTimeZeroaudioClipIds.push(clip.clip_id);
    }
  });

  // none of the clips are starting at 0sec
  if (startTimeZeroaudioClipIds.length === 0) {
    return {
      data: [],
      message: 'None of the clips are starting at 0sec. Success OK!',
    };
  }
  // there are clips that start at 0sec
  else {
    return await Audio_Clips.findAll({
      where: {
        clip_id: startTimeZeroaudioClipIds,
      },
      logging: false,
      // raw: true, // for getting just data and no db info
    })
      .then(async (result) => {
        return await Promise.all(
          result.map((clip) => {
            clip.update({ clip_start_time: clip.clip_start_time + 1 });
          })
        )
          .then((value) => {
            // return success, start times updated.
            return {
              data: [],
              message: 'Clip Start Times Updated. Success OK!',
            };
          })
          .catch((err) => {
            return {
              data: null,
              message:
                'Error nudging Clip Start Times. Please check again..' + err,
            };
          });
      })
      .catch((err) => {
        return {
          data: null,
          message:
            'Error checking for Clip Start Times. Please check again..' + err,
        };
      });
  }
};

module.exports = nudgeStartTimeIfZero;
