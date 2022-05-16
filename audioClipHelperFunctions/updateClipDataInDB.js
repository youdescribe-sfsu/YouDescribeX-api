const Audio_Clips = require('../models/Audio_Clips');
// import helper files
const calculateClipEndTime = require('./calculateClipEndTime');
// import processor files
const getAudioDuration = require('../processors/getAudioDuration');

// to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
const updateDataInDB = async (data) => {
  // check if there is an error in text to speech generation
  if (!data.textToSpeechOutput.status) {
    let updateStatus = {
      clip_id: data.clip_id,
      message: 'Unable to generate Text to Speech!! Please try again',
    };
    return updateStatus;
  }
  // text to speech generation is successful
  else {
    // calculate audio duration
    console.log('Generating Audio Duration');
    let clipDuration = await getAudioDuration(data.textToSpeechOutput.filepath);
    // calculate audio clip end time
    console.log('Generating Audio Clip End Time');
    let clipEndTime = await calculateClipEndTime(data.clip_id, clipDuration);
    // update the path of the audio file & the description text for the audio clip in the db
    let updateStatus = await Audio_Clips.update(
      {
        clip_audio_path: data.textToSpeechOutput.filepath,
        clip_duration: parseFloat(clipDuration),
        clip_end_time: parseFloat(clipEndTime),
      },
      {
        where: {
          clip_id: data.clip_id,
        },
      }
    )
      .then(() => {
        let status = { clip_id: data.clip_id, message: 'Success OK' };
        return status;
        // return the success msg with the clip_id
      })
      .catch((err) => {
        console.log(err);
        let status = {
          clip_id: data.clip_id,
          message: 'Unable to Update Audio Path in the DB!! Please try again',
        };
        return status;
        // return the error msg with the clip_id
      });
    return updateStatus;
  }
};

module.exports = updateDataInDB;
