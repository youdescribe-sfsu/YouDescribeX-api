const Audio_Clips = require('../models/Audio_Clips');
// calculate audio clip end time
const calculateClipEndTime = async (clipId, audioDuration) => {
  return Audio_Clips.findOne({
    where: {
      clip_id: clipId,
    },
    attributes: ['clip_start_time'],
  })
    .then((clip) => {
      const clipEndTime = parseFloat(
        parseFloat(clip.clip_start_time).toFixed(2) +
          parseFloat(audioDuration).toFixed(2)
      ).toFixed(2);
      return {
        message: 'Success',
        data: clipEndTime,
      };
    })
    .catch((err) => {
      return {
        message: `Error Connecting to DB - Calculate End Time!! Please try again. ${err}`,
        data: null,
      }; // send error message
    });
};

module.exports = calculateClipEndTime;
