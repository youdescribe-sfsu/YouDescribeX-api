const express = require('express');
const router = express.Router();
const audioClipsController = require('../controllers/audioClipsController');

// Routes - send request to controller where db processing is done
// get all Audio Clips route
router.use(express.json());
router.get('/get-all-audio-clips', audioClipsController.getAllAudioClips);

// get one Audio Clip row route - based on clip id
router.get('/get-audio-clips/:clipId', audioClipsController.getAudioClip);

// get user Audio Clip row - based on adId
router.get('/get-user-ad/:adId', audioClipsController.getADAudioClips);

module.exports = router;
