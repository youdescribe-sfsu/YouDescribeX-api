const Audio_Clips = require('../models/Audio_Clips');
// import helper files
const calculateClipEndTime = require('./calculateClipEndTime');
const analyzeOverlapsAndAdjust = require('./overlapAnalysisHelperFunctions/analyzeOverlapsAndAdjust');
const getClipStartTimebyId = require('./getClipStartTimebyId');
// import processor files
const getAudioDuration = require('../processors/getAudioDuration');
const updatePlaybackAndTimes = require('./overlapAnalysisHelperFunctions/updatePlaybackAndTimes');

// to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
const updateClipDataInDB = async (data) => {
  // check if there is an error in text to speech generation
  if (!data.textToSpeechOutput.status) {
    return {
      clip_id: data.clip_id,
      message: 'Unable to generate Text to Speech!! Please try again',
    };
  }
  // text to speech generation is successful
  else {
    // calculate audio duration
    console.log('Generating Audio Duration');
    let clipDurationStatus = await getAudioDuration(
      data.textToSpeechOutput.filepath
    );
    // check if the returned data is null - an error in generating Audio Duration
    if (clipDurationStatus.data === null) {
      return {
        clip_id: data.clip_id,
        message: clipDurationStatus.message,
      };
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
        return {
          clip_id: data.clip_id,
          message: clipEndTimeStatus.message,
        };
      } else {
        // Clip End Time Calculation Successful
        const clipEndTime = clipEndTimeStatus.data;

        // update the path of the audio file, duration, end time of the audio clip in the db
        return await Audio_Clips.update(
          {
            clip_audio_path: data.textToSpeechOutput.filepath,
            clip_duration: parseFloat(clipDuration),
            clip_end_time: parseFloat(clipEndTime),
          },
          {
            where: {
              clip_id: data.clip_id,
            },
            // logging: false,
          }
        )
          .then(async () => {
            // try to analyze playback type/overlaps here
            // getClipStartTimebyId
            let getClipStartTimeStatus = await getClipStartTimebyId(
              data.clip_id
            );
            // check if the returned data is null - an error in analyzing Playback type
            if (getClipStartTimeStatus.data === null) {
              return {
                clip_id: data.clip_id,
                message: getClipStartTimeStatus.message,
              };
            } else {
              let clipStartTime = getClipStartTimeStatus.data;

              // analyze clip playback type & Start Time from dialog timestamp & Audio Clips data
              console.log(
                'Analyzing clip playback type & Start Time from dialog timestamp & Audio Clips data'
              );
              let analysisStatus = await analyzeOverlapsAndAdjust(
                clipStartTime,
                clipEndTime,
                data.video_id,
                data.ad_id,
                data.clip_id,
                data.description_type,
                data.video_length
              );
              // check if the returned data is null - an error in analyzing Playback type / Start Time
              if (analysisStatus.data === null) {
                return {
                  clip_id: data.clip_id,
                  message: analysisStatus.message,
                };
              }
              // audio clips are processed
              else {
                const playbackType = analysisStatus.data.playbackType;
                const clipStartTime = analysisStatus.data.clipStartTime;
                const clipEndTime = analysisStatus.data.clipEndTime;

                const updateStatus = await updatePlaybackAndTimes(
                  data.clip_id,
                  playbackType,
                  clipStartTime,
                  clipEndTime
                );
                return {
                  clip_id: data.clip_id,
                  message: analysisStatus.message,
                  data: analysisStatus.data,
                  updateStatus: updateStatus,
                };
              }
            }
          })
          .catch((err) => {
            console.log(err);
            return {
              clip_id: data.clip_id,
              message: 'Unable to Update DB !! Please try again' + err,
            };
            // return the error msg with the clip_id
          });
      }
    }
  }
};

module.exports = updateClipDataInDB;
