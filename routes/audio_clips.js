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

// update user Audio Clip title - based on clip Id
router.put(
  '/update-ad-title/:clipId',
  audioClipsController.updateAudioClipTitle
);

// update user Audio Clip Playback type - based on clip Id
router.put(
  '/update-ad-playback-type/:clipId',
  audioClipsController.updateAudioClipPlaybackType
);

// update user Audio Clip Playback type - based on clip Id
router.put(
  '/update-ad-start-time/:clipId',
  audioClipsController.updateAudioClipStartTime
);

// update Audio Clip Description & Generate a new mp3 for it
router.put(
  '/update-ad-description/:clipId',
  audioClipsController.updateAudioDescription
);
module.exports = router;
