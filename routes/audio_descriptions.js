const express = require('express');
const router = express.Router();
const audioDescriptionsController = require('../controllers/audioDescriptionsController');

router.use(express.json());

// Routes - send request to controller where db processing is done
// get user Audio Description Data (including Notes, AudioClips) - based on UserId & VideoId
router.get(
  '/get-user-ad/:videoId&:userId',
  audioDescriptionsController.getUserAudioDescriptionData
);

module.exports = router;
