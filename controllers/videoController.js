const Videos = require('../models/Videos');
const Audio_Descriptions = require('../models/Audio_Descriptions');
const Audio_Clips = require('../models/Audio_Clips');
const Notes = require('../models/Notes');

// db processing is done here using sequelize models

// find one Video by YouTubeVideoId
exports.getVideobyYoutubeId = async (req, res) => {
  Videos.findOne({
    where: {
      youtube_video_id: req.params.youtubeId,
    },
  })
    .then((videos) => {
      return res.status(200).send(videos);
    })
    .catch((err) => {
      console.log(err.message);
      return res.status(500).send(err.message);
    });
};

// Delete YouTube Video by VideoId for User
exports.deleteVideoByUser = async (req, res) => {
  Videos.findOne({
    where: {
      youtube_video_id: req.params.youtubeId,
    },
  })
    .then((videos) => {
      Audio_Descriptions.findOne({
        where: {
          UserUserId: req.params.userId,
          VideoVideoId: videos.video_id,
        }
      }).then(audioDescriptionData => {
        Notes.destroy({
          where: {
            AudioDescriptionAdId: audioDescriptionData.ad_id
          }
        }).then(notesData => {
          Audio_Clips.destroy({
            where: {
              AudioDescriptionAdId: audioDescriptionData.ad_id
            }
          }).then(audioClipsData => {
            Audio_Descriptions.destroy({
              where: {
                UserUserId: req.params.userId,
                VideoVideoId: videos.video_id,
              }
            }).then(audioDescriptionData => {

              return res.status(200).send({ notesData, audioClipsData, audioDescriptionData, videosData });
            })
          })
        })
      })
    })
    .catch((err) => {
      console.log(err.message);
      return res.status(500).send(err.message);
    });
};