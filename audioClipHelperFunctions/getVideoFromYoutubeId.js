const Videos = require('../models/Videos');

// find one Video by YouTubeVideoId
const getVideoFromYoutubeId = async (youtubeVideoID) => {
  return Videos.findOne({
    where: {
      youtube_video_id: youtubeVideoID,
    },
  })
    .then((video) => {
      return { message: 'Success', data: video.video_id };
    })
    .catch((err) => {
      return {
        message:
          'Error Connecting to DB!! Please try again. getVideoFromYoutubeId ' +
          err,
        data: null,
      };
    });
};

module.exports = getVideoFromYoutubeId;
