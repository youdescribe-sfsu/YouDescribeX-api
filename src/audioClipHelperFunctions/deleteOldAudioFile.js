// delete the old audio file from the local system
const fs = require('fs');
const deleteOldAudioFile = async (old_audio_path) => {
  const path = old_audio_path.replace('.', './public');
  try {
    fs.unlinkSync(path);
    console.log('Old Audio File Deleted');
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
};

module.exports = deleteOldAudioFile;
