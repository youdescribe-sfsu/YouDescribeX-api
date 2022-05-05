const Audio_Clips = require('../models/Audio_Clips');
const generateMp3forDescriptionText = require('../processor/textToSpeech');

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
    // update the path of the audio file & the description text for the audio clip in the db
    Audio_Clips.findOne({
      where: {
        clip_id: req.params.clipId,
      },
    })
      .then((obj) => {
        if (obj) {
          obj
            .update({
              clip_audio_path: response.filepath,
              description_text:
                req.body.clipDescriptionText || clip.description_text,
            })
            .then((clip) => {
              console.log('status ok');
              return res.status(200).send({
                message: 'Success OK',
              });
            })
            .catch((err) => {
              console.log(err);
              return res.status(500).send({
                message: 'Unable to update Description!! Please try again',
              }); // send error message
            });
        } else {
          return res.status(404).send({
            message: 'Audio Clip Not Found!! Please try again',
          });
        }
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send({
          message: 'Unable to connect to DB!! Please try again',
        }); // send error message
      });
  }
};
