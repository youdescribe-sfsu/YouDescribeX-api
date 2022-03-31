const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
router.use(express.json());

// Routes - send request to controller where db processing is done
// get all videos route
router.get('/all-videos', videoController.getAllVideos);
// get one video route
router.get('/get-video/:id', videoController.getVideo);

module.exports = router;
