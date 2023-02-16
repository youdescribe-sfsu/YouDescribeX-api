const Users = require('../models/Users');
const Audio_Descriptions = require('../models/Audio_Descriptions');
const Audio_Clips = require('../models/Audio_Clips');
const getAIUserId = require('../userLinksHelperFunctions/getAIUserId');
const getVideoFromYoutubeId = require('../audioClipHelperFunctions/getVideoFromYoutubeId'); // get the video id by youtubeId
const checkIfAdExists = require('../userLinksHelperFunctions/checkIfAdExists');

// db processing is done here using sequelize models

// add new user
exports.addNewUser = async (req, res) => {
  Users.create({
    is_ai: false,
    name: req.body.name,
    user_email: req.body.email,
  })
    .then((user) => {
      console.log(user);
      res.status(200).send(user);
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send(err);
    });
};

// create new user Audio Description & Add Audio Clips
exports.createNewUserAd = async (req, res) => {
  //  get video_id from youtubeVideoID
  let getVideoIdStatus = await getVideoFromYoutubeId(req.body.youtubeVideoId);
  if (getVideoIdStatus.data === null) {
    return res.status(500).send({
      message: getVideoIdStatus.message,
    });
  } else {
    let videoId = getVideoIdStatus.data;

    // check if there is an existing Audio Description.. If yes, throw an error
    let checkIfAdExistsStatus = await checkIfAdExists(req.body.userId, videoId);

    if (checkIfAdExistsStatus.data === null) {
      return res.status(500).send({
        message: checkIfAdExistsStatus.message,
      });
    } else {
      // No AD exists.. So We can create one

      //   get AI user ID
      let getAIUserIdStatus = await getAIUserId();
      if (getAIUserIdStatus.data === null) {
        return res.status(500).send({
          message: getAIUserIdStatus.message,
        });
      } else {
        let AIUserId = getAIUserIdStatus.data;
        // fetch Audio Description & Audio Clip Data for AI user to copy for the new user
        await Audio_Descriptions.findOne({
          where: {
            VideoVideoId: videoId,
            UserUserId: AIUserId,
          },
          // nesting Audio_Clips data too
          include: [
            {
              model: Audio_Clips,
              separate: true, // this is nested data, so ordering works only with separate true
              order: ['clip_start_time'],
            },
          ],
        })
          .then(async (data) => {
            if (data === null) {
              return res.status(404).send({
                message: 'No AI Audio Descriptions Found',
              });
            } else {
              await Audio_Descriptions.create({
                VideoVideoId: videoId,
                UserUserId: req.body.userId,
                is_published: false,
              })
                .then(async (ad) => {
                  for (const clip of data.Audio_Clips) {
                    await Audio_Clips.create({
                      clip_title: clip.clip_title,
                      description_type: clip.description_type,
                      description_text: clip.description_text,
                      playback_type: clip.playback_type,
                      clip_start_time: clip.clip_start_time,
                      is_recorded: false,
                    })
                      .then((new_clip) => {
                        ad.addAudio_Clip(new_clip);
                      })
                      .catch((err) => {
                        console.log(err);
                        return res.status(500).send({
                          message: err,
                        });
                      });
                  }
                  return res.status(200).send({
                    message: `Success OK!! Use https://ydx.youdescribe.org/api/audio-clips/processAllClipsInDB/${ad.ad_id} to generate audio files for the new Audio Description.`,
                    url:`https://ydx.youdescribe.org/api/audio-clips/processAllClipsInDB/${ad.ad_id}`
                  });
                })
                .catch((err) => {
                  console.log(err);
                  return res.status(500).send({
                    message: err,
                  });
                });
            }
          })
          .catch((err) => {
            console.log(err);
            return res.status(500).send({
              message: err,
            });
          });
      }
    }
  }
};