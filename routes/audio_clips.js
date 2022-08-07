const express = require('express');
const router = express.Router();
const audioAllClipsMP3Controller = require('../controllers/audioAllClipsMP3Controller'); // generating mp3 for all AudioClips based on AdId
const audioClipsController = require('../controllers/audioClipsController'); // handles routes for all other audioClip requests
const upload = require('../processors/audioFileProcessor'); // import the multer audio processor

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

// route to process all audio clips in the db - based on video id
router.get(
  '/processAllClipsInDB/:adId',
  audioAllClipsMP3Controller.processAllClipsInDB
);

// Routes - send request to controller where db processing is done
// PUT Requests
// update user Audio Clip title - based on clip Id
router.put(
  '/update-clip-title/:clipId',
  audioClipsController.updateAudioClipTitle
);

// update user Audio Clip Playback type - based on clip Id
router.put(
  '/update-clip-playback-type/:clipId',
  audioClipsController.updateAudioClipPlaybackType
);

// update user Audio Clip Start Time type - based on clip Id, update endtime based on duration
router.put(
  '/update-clip-start-time/:clipId',
  audioClipsController.updateAudioClipStartTime
);

// update Audio Clip Description & Generate a new mp3, update endtime & duration for it
router.put(
  '/update-clip-description/:clipId',
  audioClipsController.updateAudioClipDescription
);

// update clip audio path for record & replace
router.put(
  '/record-replace-clip-audio/:clipId',
  upload.single('file'),
  audioClipsController.updateClipAudioPath
);

//POST Requests
// add a new clip
router.post(
  '/add-new-clip/:adId',
  upload.single('file'),
  audioClipsController.addNewAudioClip
);

// DELETE Requests
// delete a clip based on clipId
router.delete('/delete-clip/:clipId', audioClipsController.deleteAudioClip);

module.exports = router;
