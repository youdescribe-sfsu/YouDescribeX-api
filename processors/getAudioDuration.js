const { getAudioDurationInSeconds } = require('get-audio-duration');

const getAudioDuration = async (filepath) => {
  const path = filepath.replace('.', './public');
  return await getAudioDurationInSeconds(path)
    .then((duration) => {
      return {
        message: 'Success',
        data: duration,
      };
    })
    .catch((err) => {
      return {
        message: 'Error in Getting Audio Duration!! Please try again',
        data: null,
      };
    });
};

module.exports = getAudioDuration;
