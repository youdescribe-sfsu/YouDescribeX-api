const express = require('express');
const router = express.Router();
const audioAllClipsMP3Controller = require('../controllers/audioAllClipsMP3Controller'); // generating mp3 for all AudioClips based on AdId
const audioClipsController = require('../controllers/audioClipsController'); // handles routes for all other audioClip requests

router.use(express.json());

// route to generate mp3 files for all audio clips in the db - based on video id
router.get(
  '/generateMp3ForAllClipsInDB/:adId',
  audioAllClipsMP3Controller.generateMP3ForAllClipsInDB
);

// Routes - send request to controller where db processing is done
// PUT Requests
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
  audioClipsController.updateAudioClipDescription
);
module.exports = router;
