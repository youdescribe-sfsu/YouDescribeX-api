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

//POST Requests
// add a new clip
exports.addNewAudioClip = async (req, res) => {
  Audio_Clips.create({
    clip_title: req.body.newACTitle,
    description_type: req.body.newACType,
    description_text: req.body.newACDescriptionText,
    playback_type: req.body.newACPlaybackType,
    clip_start_time: req.body.newACStartTime,
    is_recorded: req.body.isRecorded,
    AudioDescriptionAdId: req.params.adId,
  })
    .then((clip) => {
      return res.status(200).send(clip);
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send(err);
    });
};

// DELETE Requests
// delete a clip based on clipId
exports.deleteAudioClip = async (req, res) => {
  console.log(req.params.clipId);
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
};
