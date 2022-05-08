const Audio_Clips = require('../models/Audio_Clips');
const Audio_Descriptions = require('../models/Audio_Descriptions');
const Videos = require('../models/Videos');
const fs = require('fs');
const generateMp3forDescriptionText = require('../processors/textToSpeech');
const getAudioDuration = require('../processors/getAudioDuration');

// db processing to generate mp3 for all audio clip texts
exports.generateMP3ForAllClipsInDB = async (req, res) => {
  // generate mp3 for all audio clips - given audio description ID as a parameter
  console.log(
    'Fetching Audio Video Data from Audio_Clips, Audio_Descriptions, Videos'
  );
  Audio_Clips.findAll({
    where: {
      AudioDescriptionAdId: req.params.adId,
    },
    // nesting the associations to fetch userID, videoID, YoutubeVideoID
    include: [
      {
        model: Audio_Descriptions,
        attributes: ['UserUserId', 'VideoVideoId'],
        include: [
          {
            model: Videos,
            attributes: ['youtube_video_id'],
          },
        ],
      },
    ],
  })
    // get all the AudioClips Data along with userID, videoID, YoutubeVideoID
    .then((ADAudioClips) => {
      // proceed only if audioclips exist
      if (ADAudioClips.length > 0) {
        // initialize an array to store the description texts
        let descriptionTexts = [];
        ADAudioClips.forEach((clip) => {
          // create an obj to store the related stuff
          let obj = {
            clip_id: clip.clip_id,
            clip_description_type: clip.description_type,
            clip_description_text: clip.description_text,
            video_id: clip.Audio_Description.VideoVideoId,
            user_id: clip.Audio_Description.UserUserId,
            youtube_id: clip.Audio_Description.Video.youtube_video_id,
          };
          // push each clip data to the array
          descriptionTexts.push(obj);
        });
        return descriptionTexts;
      }
      // if there are no matching audioclips
      else {
        return res.status(404).send({
          message: 'No Audio Clips found!! Please try again',
        });
      }
    })
    .then(async (descriptionTexts) => {
      // initialize an empty array for storing statusData
      let statusData = [];
      // wait for text to speech generation of all description texts
      await Promise.all(
        descriptionTexts.map(async (desc) => {
          console.log('Generating Text to Speech');
          // add the text to speech output and the clip_id to an object and push to statusData
          let data = {
            textToSpeechOutput: await generateMp3forDescriptionText(
              desc.user_id,
              desc.youtube_id,
              desc.clip_description_text,
              desc.clip_description_type
            ),
            clip_id: desc.clip_id,
          };
          statusData.push(data);
        })
        // status Data now has text to speech generation status of each clip_id
      ).then(async () => {
        let updateStatusOfAllClips = [];
        // wait until all promises are done
        await Promise.all(
          statusData.map(async (data) => {
            console.log('Yet to update data in DB');
            // to update clip_audio_path, clip_duration, clip_end_time columns of Audio_Clips Table
            let updateStatus = await updateDataInDB(data);
            // get the status message and push it to an array
            updateStatusOfAllClips.push(updateStatus);
          })
        ).then(() => {
          // send the status messages along with the clip_id's as a response
          res.send(updateStatusOfAllClips);
        });
      });
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send({
        message: 'Unable to connect to DB!! Please try again',
      }); // send error message
    });
};

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

// db processing is done here using sequelize models
// find all Audio_Clips
exports.getAllAudioClips = async (req, res) => {
  Audio_Clips.findAll()
    .then((allAudioClips) => {
      console.log(allAudioClips);
      return res.send(allAudioClips);
    })
    .catch((err) => console.log(err));
};

// find one Audio_Clips row - based on id
exports.getAudioClip = async (req, res) => {
  Audio_Clips.findOne({
    where: {
      clip_id: req.params.clipId,
    },
  })
    .then((AudioClip) => {
      console.log(AudioClip);
      return res.send(AudioClip);
    })
    .catch((err) => {
      console.log(err);
    });
};

// find the Audio_Clips - based on ad_id
exports.getADAudioClips = async (req, res) => {
  Audio_Clips.findAll({
    where: {
      AudioDescriptionAdId: req.params.adId,
    },
    order: ['clip_start_time'],
    logging: false,
  })
    .then((ADAudioClips) => {
      console.log(ADAudioClips);
      return res.send(ADAudioClips);
    })
    .catch((err) => {
      console.log(err);
    });
};

// PUT Requests
// update audio clip Title - based on clip_id
// check if there exists a record, if yes update it
exports.updateAudioClipTitle = async (req, res) => {
  Audio_Clips.findOne({
    where: {
      clip_id: req.params.clipId,
    },
  })
    .then((obj) => {
      if (obj) {
        obj
          .update({ clip_title: req.body.adTitle || clip.clip_title })
          .then((clip) => {
            console.log(clip);
            return res.send(clip);
          })
          .catch((err) => {
            console.log(err);
            return res.send(err);
          });
      } else {
        return res.status(404).send({
          message: 'Audio Clip Not Found',
        });
      }
    })
    .catch((err) => {
      console.log(err);
      return res.send(err);
    });
};

// update audio clip Playback Type - from inline to extended or vice versa - based on clip_id
// check if there exists a record, if yes update it
exports.updateAudioClipPlaybackType = async (req, res) => {
  Audio_Clips.findOne({
    where: {
      clip_id: req.params.clipId,
    },
  })
    .then((obj) => {
      if (obj) {
        obj
          .update({
            playback_type: req.body.clipPlaybackType || clip.playback_type,
          })
          .then((clip) => {
            console.log(clip);
            return res.send(clip);
          })
          .catch((err) => {
            console.log(err);
            return res.send(err);
          });
      } else {
        return res.status(404).send({
          message: 'Audio Clip Not Found',
        });
      }
    })
    .catch((err) => {
      console.log(err);
      return res.send(err);
    });
};

// update audio clip Start Time based on clip_id
// check if there exists a record, if yes update it
exports.updateAudioClipStartTime = async (req, res) => {
  Audio_Clips.findOne({
    where: {
      clip_id: req.params.clipId,
    },
  })
    .then((obj) => {
      if (obj) {
        obj
          .update({
            clip_start_time: req.body.clipStartTime || clip.clip_start_time,
          })
          .then((clip) => {
            console.log(clip);
            return res.send(clip);
          })
          .catch((err) => {
            console.log(err);
            return res.send(err);
          });
      } else {
        return res.status(404).send({
          message: 'Audio Clip Not Found',
        });
      }
    })
    .catch((err) => {
      console.log(err);
      return res.send(err);
    });
};

exports.updateAudioDescription = async (req, res) => {
  // process TexttoSpeech for updated description
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
    // find old audioPath in the db
    let old_audio_path = await getOldAudioFilePath(req.params.clipId);
    // calculate audio duration
    let updatedAudioDuration = await getAudioDuration(response.filepath);
    // calculate audio clip end time
    let updatedClipEndTime = await calculateClipEndTime(
      req.params.clipId,
      updatedAudioDuration
    );
    // update the path of the audio file & the description text for the audio clip in the db
    Audio_Clips.update(
      {
        clip_audio_path: response.filepath,
        description_text: req.body.clipDescriptionText || clip.description_text,
        clip_duration: parseFloat(updatedAudioDuration),
        clip_end_time: parseFloat(updatedClipEndTime),
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
        // let deleteOldAudioFileStatus = await deleteOldAudioFile(old_audio_path);
        await deleteOldAudioFile(old_audio_path);
        // if (deleteOldAudioFileStatus) {
        return res.status(200).send({
          message: 'Success OK',
        });
        // } else {
        //   return res.status(500).send({
        //     message: 'Unable to delete old Audio File!! Please try again',
        //   });
        // }
      })
      .catch((err) => {
        // console.log(err);
        return res.status(500).send({
          message: 'Unable to connect to DB!! Please try again',
        }); // send error message
      });
  }
};

// get the old audioPath in the db
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

// delete the old audio file from the local system
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
