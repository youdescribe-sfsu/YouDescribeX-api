const Audio_Clips = require('../models/Audio_Clips');
// import processor files
const generateMp3forDescriptionText = require('../processors/textToSpeech');
const getAudioDuration = require('../processors/getAudioDuration');
// import Audio Clip helper files
const calculateClipEndTime = require('../audioClipHelperFunctions/calculateClipEndTime'); // calculate audio clip end time
const deleteOldAudioFile = require('../audioClipHelperFunctions/deleteOldAudioFile'); // delete the old audio file from the local system
const getOldAudioFilePath = require('../audioClipHelperFunctions/getOldAudioFilePath'); // get the old audioPath in the db

// db processing is done here using sequelize models

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

// update audio clip Description based on params Clip Id and body with userId, youtubeVideoId, clipDescriptionText, clipDescriptionType
exports.updateAudioClipDescription = async (req, res) => {
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
        let deleteOldAudioFileStatus = await deleteOldAudioFile(old_audio_path);
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
};
