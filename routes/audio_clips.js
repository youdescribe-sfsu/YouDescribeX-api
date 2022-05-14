const express = require('express');
const router = express.Router();
const audioClipsController = require('../controllers/audioClipsController');

router.use(express.json());

// route to generate mp3 files for all audio clips in the db - based on video id
router.get(
  '/generateMp3ForAllClipsInDB/:adId',
  audioClipsController.generateMP3ForAllClipsInDB
);

// Routes - send request to controller where db processing is done
// get all Audio Clips route
router.get('/get-all-audio-clips', audioClipsController.getAllAudioClips);

// get one Audio Clip row route - based on clip id
router.get('/get-audio-clips/:clipId', audioClipsController.getAudioClip);

// get Audio Clips for one AdId- based on adId
router.get('/get-ad-audio-clips/:adId', audioClipsController.getADAudioClips);

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
