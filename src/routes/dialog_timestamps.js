const express = require('express');
const router = express.Router();
const dialogTimestampsController = require('../controllers/dialogTimestampsController');
router.use(express.json());

// Routes - send request to controller where db processing is done
// get Dialog Timestamps related to a Video
router.get(
  '/get-video-dialog/:videoId',
  dialogTimestampsController.getVideoDialogTimestamps
);

module.exports = router;
