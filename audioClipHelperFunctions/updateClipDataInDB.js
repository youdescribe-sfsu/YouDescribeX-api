const Audio_Clips = require('../models/Audio_Clips');
// import helper files
const analyzePlaybackType = require('./overlapAnalysisHelperFunctions/analyzePlaybackType');
const getClipStartTimebyId = require('./getClipStartTimebyId');
// import processor files
const getAudioDuration = require('../processors/getAudioDuration');
const updatePlaybackAndTimes = require('./overlapAnalysisHelperFunctions/updatePlaybackNTimesinDB');

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

      // fetch the updated nudged start time - done by nudgeStartTimeIfZero()
      let getClipStartTimeStatus = await getClipStartTimebyId(data.clip_id);
      // check if the returned data is null - an error in analyzing Playback type
      if (getClipStartTimeStatus.data === null) {
        return {
          clip_id: data.clip_id,
          message: getClipStartTimeStatus.message,
        };
      } else {
        let clipStartTime = parseFloat(getClipStartTimeStatus.data).toFixed(2);
        let clipEndTime = parseFloat(
          parseFloat(clipStartTime) + parseFloat(clipDuration)
        ).toFixed(2);

        // update the path of the audio file, duration, end time, start time of the audio clip in the db
        return await Audio_Clips.update(
          {
            clip_start_time: parseFloat(clipStartTime).toFixed(2), // rounding the start time
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
            // analyze clip playback type from dialog timestamp & Audio Clips data
            console.log(
              'Analyzing clip playback type from dialog timestamp & Audio Clips data'
            );
            let analysisStatus = await analyzePlaybackType(
              clipStartTime,
              clipEndTime,
              data.video_id,
              data.ad_id,
              data.clip_id
            );
            // check if the returned data is null - an error in analyzing Playback type
            if (analysisStatus.data === null) {
              return {
                clip_id: data.clip_id,
                message: analysisStatus.message,
              };
            } else {
              // dialog Timestamps
              // c43d7da2-a07c-4fc7-b1fa-bc7bfcd26a03
              // 56f1d8dd-12f2-4263-a18f-6951a8d646ff
              // 535d63b9-5768-4524-b03d-8034c3ede36a

              // Audio Clips
              // 8cf2109d-33e2-4210-b83e-e1fe68da273d
              // a81a0c2c-549b-44cb-82d0-43f7acb2885f

              return {
                clip_id: data.clip_id,
                message: analysisStatus.message,
                playbackType: analysisStatus.data,
              };
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
