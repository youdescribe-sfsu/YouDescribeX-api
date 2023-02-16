const getMP3Duration = require('get-mp3-duration');
const fs = require('fs');

const getAudioDuration = async (filepath) => {
  const path = filepath.replace('.', './public');
  try {
    const buffer = fs.readFileSync(path);
    const duration = parseFloat(getMP3Duration(buffer) / 1000).toFixed(2);
    return {
      message: 'Success',
      data: duration,
    };
  } catch (err) {
    return {
      message: 'Error in Getting Audio Duration!! Please try again',
      data: null,
    };
  }
};

module.exports = getAudioDuration;
