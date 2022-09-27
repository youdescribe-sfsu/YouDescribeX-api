const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
router.use(express.json());

// Routes - send request to controller where db processing is done
// get video by YouTubeVideoID
router.get(
  '/get-by-youtubeVideo/:youtubeId',
  videoController.getVideobyYoutubeId
);
router.delete('/delete-video/:youtubeId/:userId', videoController.deleteVideoByUser);

module.exports = router;
