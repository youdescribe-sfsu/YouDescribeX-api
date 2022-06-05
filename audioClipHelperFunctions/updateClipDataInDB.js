const Audio_Clips = require('../models/Audio_Clips');
// import helper files
const calculateClipEndTime = require('./calculateClipEndTime');
const analyzePlaybackType = require('./analyzePlaybackType');
// import processor files
const getAudioDuration = require('../processors/getAudioDuration');

// to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
const updateClipDataInDB = async (data) => {
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
    let updateStatus;

    // calculate audio duration
    console.log('Generating Audio Duration');
    let clipDurationStatus = await getAudioDuration(
      data.textToSpeechOutput.filepath
    );
    // check if the returned data is null - an error in generating Audio Duration
    if (clipDurationStatus.data === null) {
      return (updateStatus = {
        clip_id: data.clip_id,
        message: clipDurationStatus.message,
      });
    } else {
      // Audio Duration generation successful
      const clipDuration = clipDurationStatus.data;

      // calculate audio clip end time
      console.log('Generating Audio Clip End Time');
      let clipEndTimeStatus = await calculateClipEndTime(
        data.clip_id,
        clipDuration
      );
      // check if the returned data is null - an error in calculating Clip End Time
      if (clipEndTimeStatus.data === null) {
        return (updateStatus = {
          clip_id: data.clip_id,
          message: clipEndTimeStatus.message,
        });
      } else {
        // Clip End Time Calculation Successful
        const clipEndTime = clipEndTimeStatus.data;

        // analyze clip playback type from dialog timestamp data
        console.log('Analyzing PlaybackType Based on Dialog Timestamp Data');
        let playbackTypeStatus = await analyzePlaybackType(
          data.clip_id,
          clipEndTime,
          data.video_id
        );
        // check if the returned data is null - an error in analyzing Playback type
        if (playbackTypeStatus.data === null) {
          return (updateStatus = {
            clip_id: data.clip_id,
            message: playbackTypeStatus.message,
          });
        } else {
          // Clip Playback Type is returned
          const playbackType = playbackTypeStatus.data;

          // update the path of the audio file, duration, end time & playback type of the audio clip in the db
          let updateStatus = await Audio_Clips.update(
            {
              clip_audio_path: data.textToSpeechOutput.filepath,
              clip_duration: parseFloat(clipDuration),
              clip_end_time: parseFloat(clipEndTime),
              playback_type: playbackType,
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
                message: 'Unable to Update DB!! Please try again',
              };
              return status;
              // return the error msg with the clip_id
            });
          return updateStatus;
        }
      }
    }
  }
};

module.exports = updateClipDataInDB;
