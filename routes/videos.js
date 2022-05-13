const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
router.use(express.json());

// Routes - send request to controller where db processing is done
// get all videos route
router.get('/all-videos', videoController.getAllVideos);
// get one video route
router.get('/get-video/:id', videoController.getVideo);
// get video by YouTubeVideoID
router.get(
  '/get-by-youtubeVideo/:youtubeId',
  videoController.getVideobyYoutubeId
);

module.exports = router;
