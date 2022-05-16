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
        parseFloat(clip.clip_start_time) + parseFloat(audioDuration)
      );
      return clipEndTime.toFixed(2);
    })
    .catch((err) => {
      return {
        message: 'Unable to connect to DB!! Please try again',
      }; // send error message
    });
};

module.exports = calculateClipEndTime;
