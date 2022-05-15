// get the old audioPath in the db
const Audio_Clips = require('../models/Audio_Clips');
const getOldAudioFilePath = async (clipId) => {
  return Audio_Clips.findOne({
    where: {
      clip_id: clipId,
    },
    attributes: ['clip_audio_path'],
  })
    .then((clip) => {
      return clip.clip_audio_path;
    })
    .catch((err) => {
      return {
        message: 'Unable to connect to DB!! Please try again',
      }; // send error message
    });
};

module.exports = getOldAudioFilePath;
