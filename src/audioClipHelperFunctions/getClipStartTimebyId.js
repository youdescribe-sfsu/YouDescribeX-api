const Audio_Clips = require('../models/Audio_Clips');
// get Clip Start Time
const getClipStartTimebyId = async (clipId) => {
  return Audio_Clips.findOne({
    where: {
      clip_id: clipId,
    },
    attributes: ['clip_start_time'],
  })
    .then((clip) => {
      return {
        message: 'Success',
        data: clip.clip_start_time.toFixed(2),
      };
    })
    .catch((err) => {
      return {
        message: `Unable to connect to DB - getClipStartTimebyId!! Please try again ${err}`,
        data: null,
      }; // send error message
    });
};

module.exports = getClipStartTimebyId;
