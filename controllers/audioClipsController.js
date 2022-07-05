const Audio_Clips = require('../models/Audio_Clips');
// import processor files
const generateMp3forDescriptionText = require('../processors/textToSpeech');
const getAudioDuration = require('../processors/getAudioDuration');
// import Audio Clip helper files
const calculateClipEndTime = require('../audioClipHelperFunctions/calculateClipEndTime'); // calculate audio clip end time
const deleteOldAudioFile = require('../audioClipHelperFunctions/deleteOldAudioFile'); // delete the old audio file from the local system
const getOldAudioFilePath = require('../audioClipHelperFunctions/getOldAudioFilePath'); // get the old audioPath in the db
const getVideoFromYoutubeId = require('../audioClipHelperFunctions/getVideoFromYoutubeId'); // get the video id by youtubeId
const analyzePlaybackType = require('../audioClipHelperFunctions/analyzePlaybackType');
const getClipStartTimebyId = require('../audioClipHelperFunctions/getClipStartTimebyId');

// db processing is done here using sequelize models

// PUT Requests
// update audio clip Title - based on clip_id
// check if there exists a record, if yes update it
exports.updateAudioClipTitle = async (req, res) => {
  Audio_Clips.update(
    {
      clip_title: req.body.adTitle,
    },
    {
      where: {
        clip_id: req.params.clipId,
      },
    }
  )
    .then((data) => {
      return res.status(200).send(data);
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send(err);
    });
};
// update audio clip Playback Type - from inline to extended or vice versa - based on clip_id
// check if there exists a record, if yes update it
exports.updateAudioClipPlaybackType = async (req, res) => {
  Audio_Clips.update(
    {
      playback_type: req.body.clipPlaybackType,
    },
    {
      where: {
        clip_id: req.params.clipId,
      },
    }
  )
    .then((data) => {
      return res.status(200).send(data);
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send(err);
    });
};

// update audio clip Start Time based on clip_id
// check if there exists a record, if yes update it
exports.updateAudioClipStartTime = async (req, res) => {
  // get the audio_duration to update both start time & end time
  Audio_Clips.findOne({
    where: {
      clip_id: req.params.clipId,
    },
    attributes: ['clip_duration'],
  })
    .then((clip) => {
      const clipEndTime = parseFloat(
        parseFloat(req.body.clipStartTime) + parseFloat(clip.clip_duration)
      ).toFixed(2);
      return clipEndTime;
    })
    .then((clipEndTime) => {
      // update both start & end time based on clip_duration
      Audio_Clips.update(
        {
          clip_start_time: req.body.clipStartTime,
          clip_end_time: clipEndTime,
        },
        {
          where: {
            clip_id: req.params.clipId,
          },
        }
      )
        .then((data) => {
          return res.status(200).send(data);
        })
        .catch((err) => {
          console.log(err);
          return res.status(500).send(err);
        });
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send(err);
    });
};

// update audio clip Description based on params Clip Id and body with userId, youtubeVideoId, clipDescriptionText, clipDescriptionType
exports.updateAudioClipDescription = async (req, res) => {
  // process TexttoSpeech for updated description
  console.log('Converting Text to Speech...');
  let response = await generateMp3forDescriptionText(
    req.body.userId,
    req.body.youtubeVideoId,
    req.body.clipDescriptionText,
    req.body.clipDescriptionType
  );
  // check if there is an error
  if (!response.status) {
    return res.status(500).send({
      message: 'Unable to generate Text to Speech!! Please try again',
    }); // send error message
  } else {
    console.log('Finding Old Audio Path (to delete it later)...');
    // find old audioPath in the db
    let oldAudioFilePathStatus = await getOldAudioFilePath(req.params.clipId);
    if (oldAudioFilePathStatus.data === null) {
      return res.status(500).send({
        message: oldAudioFilePathStatus.message,
      });
    } else {
      // old audio path is returned successfully
      let old_audio_path = oldAudioFilePathStatus.data;

      // calculate audio duration
      console.log('Generating Audio Duration');
      let clipDurationStatus = await getAudioDuration(response.filepath);
      // check if the returned data is null - an error in generating Audio Duration
      if (clipDurationStatus.data === null) {
        return res.status(500).send({
          message: clipDurationStatus.message,
        });
      } else {
        // Audio Duration generation successful
        const updatedAudioDuration = clipDurationStatus.data;
        // calculate audio clip end time
        console.log('Generating Audio Clip End Time');
        let clipEndTimeStatus = await calculateClipEndTime(
          req.params.clipId,
          updatedAudioDuration
        );
        // check if the returned data is null - an error in calculating Clip End Time
        if (clipEndTimeStatus.data === null) {
          return res.status(500).send({
            message: clipEndTimeStatus.message,
          });
        } else {
          // Clip End Time Calculation Successful
          let updatedClipEndTime = clipEndTimeStatus.data;

          // get video_id from youtubeVideoID
          let getVideoIdStatus = await getVideoFromYoutubeId(
            req.body.youtubeVideoId
          );
          console.log(getVideoIdStatus);
          if (getVideoIdStatus.data === null) {
            return res.status(500).send({
              message: getVideoIdStatus.message,
            });
          } else {
            let videoId = getVideoIdStatus.data;
            // getClipStartTimebyId
            let getClipStartTimeStatus = await getClipStartTimebyId(
              req.params.clipId
            );
            // check if the returned data is null - an error in analyzing Playback type
            if (getClipStartTimeStatus.data === null) {
              return res.status(500).send({
                message: getClipStartTimeStatus.message,
              });
            } else {
              let clipStartTime = getClipStartTimeStatus.data;

              // analyze clip playback type from dialog timestamp data
              console.log(
                'Analyzing PlaybackType Based on Dialog Timestamp Data'
              );
              let playbackTypeStatus = await analyzePlaybackType(
                clipStartTime,
                updatedClipEndTime,
                videoId,
                req.body.audioDescriptionId,
                req.params.clipId
              );
              // check if the returned data is null - an error in analyzing Playback type
              if (playbackTypeStatus.data === null) {
                return res.status(500).send({
                  message: playbackTypeStatus.message,
                });
              } else {
                // Clip Playback Type is returned
                const playbackType = playbackTypeStatus.data;

                // update the path of the audio file & the description text for the audio clip in the db
                Audio_Clips.update(
                  {
                    clip_audio_path: response.filepath,
                    description_text:
                      req.body.clipDescriptionText || clip.description_text,
                    clip_duration: parseFloat(updatedAudioDuration),
                    clip_end_time: parseFloat(updatedClipEndTime),
                    playback_type: playbackType,
                  },
                  {
                    where: {
                      clip_id: req.params.clipId,
                    },
                  }
                )
                  .then(async (clip) => {
                    console.log(
                      'Updated Clip Audio Path, Clip Description Text, Clip Duration, Clip End Time'
                    );
                    // wait until the old file gets deleted
                    let deleteOldAudioFileStatus = await deleteOldAudioFile(
                      old_audio_path
                    );
                    // await deleteOldAudioFile(old_audio_path);
                    if (deleteOldAudioFileStatus) {
                      return res.status(200).send({
                        message: 'Success OK',
                      });
                    } else {
                      return res.status(500).send({
                        message: 'Problem Saving Audio!! Please try again',
                      });
                    }
                  })
                  .catch((err) => {
                    // console.log(err);
                    return res.status(500).send({
                      message: 'Server Error!! Please try again',
                    }); // send error message
                  });
              }
            }
          }
        }
      }
    }
  }
};

// update clip audio path for record & replace
exports.updateClipAudioPath = async (req, res) => {
  if (req.file) {
    // get new clip audio path, calculate duration & endtime and playbackType
    const clipAudioFilePath = String(req.file.path)
      .split('\\')
      .join('/')
      .replace('public', '.');
    const recordedClipDuration = req.body.recordedClipDuration;
    // calculate audio clip end time
    console.log('Calculating Audio Clip End Time');
    // Clip End Time Calculation based on Audio Duration & Start Time
    var newClipEndTime = parseFloat(
      parseFloat(req.body.clipStartTime) + parseFloat(recordedClipDuration)
    ).toFixed(2);
    // get video_id from youtubeVideoID
    let getVideoIdStatus = await getVideoFromYoutubeId(req.body.youtubeVideoId);
    if (getVideoIdStatus.data === null) {
      return res.status(500).send({
        message: getVideoIdStatus.message,
      });
    } else {
      let videoId = getVideoIdStatus.data;
      // analyze clip playback type from dialog timestamp data
      console.log('Analyzing PlaybackType Based on Dialog Timestamp Data');
      let playbackTypeStatus = await analyzePlaybackType(
        req.body.clipStartTime,
        newClipEndTime,
        videoId,
        req.body.audioDescriptionId,
        req.params.clipId
      );
      // check if the returned data is null - an error in analyzing Playback type
      if (playbackTypeStatus.data === null) {
        return res.status(500).send({
          message: playbackTypeStatus.message,
        });
      } else {
        // Clip Playback Type is returned
        var newPlaybackType = playbackTypeStatus.data;

        // find and delete the old audio file
        console.log('Finding Old Audio Path');
        // find old audioPath in the db
        let oldAudioFilePathStatus = await getOldAudioFilePath(
          req.params.clipId
        );
        if (oldAudioFilePathStatus.data === null) {
          return res.status(500).send({
            message: oldAudioFilePathStatus.message,
          });
        } else {
          // old audio path is returned successfully
          let old_audio_path = oldAudioFilePathStatus.data;
          // wait until the old file gets deleted
          let deleteOldAudioFileStatus = await deleteOldAudioFile(
            old_audio_path
          );
          if (!deleteOldAudioFileStatus) {
            return res.status(500).send({
              message: 'Problem Saving Audio!! Please try again',
            });
          } else {
            Audio_Clips.update(
              {
                playback_type: newPlaybackType,
                clip_end_time: newClipEndTime,
                clip_duration: recordedClipDuration,
                clip_audio_path: clipAudioFilePath,
                is_recorded: true,
                description_text: req.body.clipDescriptionText,
              },
              {
                where: {
                  clip_id: req.params.clipId,
                },
              }
            )
              .then((clip) => {
                return res.status(200).send(clip);
              })
              .catch((err) => {
                console.log(err);
                return res.status(500).send(err);
              });
          }
        }
      }
    }
  } else {
    return res.status(400).send({
      message: 'No Recording to Upload',
    });
  }
};

//POST Requests
// add a new clip
exports.addNewAudioClip = async (req, res) => {
  // recorded AudioClip
  if (req.file && req.body.isRecorded) {
    // get new clip audio path, calculate duration & endtime and playbackType
    var newClipAudioFilePath = String(req.file.path)
      .split('\\')
      .join('/')
      .replace('public', '.');
    var newAudioDuration = req.body.newACDuration;
  }
  // New Audio Clip with Description Text (isRecorded = false)
  else {
    console.log('Converting Text to Speech...');
    // process TexttoSpeech for the new description text
    let response = await generateMp3forDescriptionText(
      req.body.userId,
      req.body.youtubeVideoId,
      req.body.newACDescriptionText,
      req.body.newACType
    );
    // check if there is an error
    if (!response.status) {
      return res.status(500).send({
        message: 'Unable to generate Text to Speech!! Please try again',
      }); // send error message
    } else {
      var newClipAudioFilePath = response.filepath;
      // calculate audio duration
      console.log('Generating Audio Duration');
      let clipDurationStatus = await getAudioDuration(newClipAudioFilePath);
      // check if the returned data is null - an error in generating Audio Duration
      if (clipDurationStatus.data === null) {
        return res.status(500).send({
          message: clipDurationStatus.message,
        });
      } else {
        // Audio Duration generation successful
        var newAudioDuration = clipDurationStatus.data;
      }
    }
  }
  // calculate audio clip end time
  console.log('Calculating Audio Clip End Time');
  // Clip End Time Calculation based on Audio Duration & Start Time
  var newClipEndTime = parseFloat(
    parseFloat(req.body.newACStartTime) + parseFloat(newAudioDuration)
  ).toFixed(2);
  // get video_id from youtubeVideoID
  let getVideoIdStatus = await getVideoFromYoutubeId(req.body.youtubeVideoId);
  if (getVideoIdStatus.data === null) {
    return res.status(500).send({
      message: getVideoIdStatus.message,
    });
  } else {
    let videoId = getVideoIdStatus.data;
    // analyze clip playback type from dialog timestamp data
    console.log('Analyzing PlaybackType Based on Dialog Timestamp Data');
    let playbackTypeStatus = await analyzePlaybackType(
      req.body.newACStartTime,
      newClipEndTime,
      videoId,
      req.params.adId,
      null
    );
    // check if the returned data is null - an error in analyzing Playback type
    if (playbackTypeStatus.data === null) {
      return res.status(500).send({
        message: playbackTypeStatus.message,
      });
    } else {
      // Clip Playback Type is returned
      var newPlaybackType = playbackTypeStatus.data;
      Audio_Clips.create({
        clip_title: req.body.newACTitle,
        description_type: req.body.newACType,
        description_text: req.body.newACDescriptionText,
        playback_type: newPlaybackType,
        clip_start_time: req.body.newACStartTime,
        clip_end_time: newClipEndTime,
        clip_duration: newAudioDuration,
        clip_audio_path: newClipAudioFilePath,
        is_recorded: req.body.isRecorded,
        AudioDescriptionAdId: req.params.adId,
      })
        .then((clip) => {
          const playBackTypeMsg =
            newPlaybackType === req.body.newACPlaybackType
              ? ''
              : `Note: The playback type of the new clip is modified to ${newPlaybackType}`;
          return res.status(200).send(playBackTypeMsg);
        })
        .catch((err) => {
          console.log(err);
          return res.status(500).send(err);
        });
    }
  }
};

// DELETE Requests
// delete a clip based on clipId
exports.deleteAudioClip = async (req, res) => {
  // find and delete the old audio file
  console.log('Finding Old Audio Path');
  // find old audioPath in the db
  let oldAudioFilePathStatus = await getOldAudioFilePath(req.params.clipId);
  if (oldAudioFilePathStatus.data === null) {
    return res.status(500).send({
      message: oldAudioFilePathStatus.message,
    });
  } else {
    // old audio path is returned successfully
    let old_audio_path = oldAudioFilePathStatus.data;
    // wait until the old file gets deleted
    let deleteOldAudioFileStatus = await deleteOldAudioFile(old_audio_path);
    if (!deleteOldAudioFileStatus) {
      return res.status(500).send({
        message: 'Problem Saving Audio!! Please try again',
      });
    } else {
      // delete clip
      Audio_Clips.destroy({
        where: {
          clip_id: req.params.clipId,
        },
      })
        .then((clip) => {
          console.log(clip);
          return res.status(200).send('Clip Deleted Successfully');
        })
        .catch((err) => {
          console.log(err);
          return res.status(500).send(err);
        });
    }
  }
};
