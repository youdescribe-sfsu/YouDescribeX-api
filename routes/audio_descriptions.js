const express = require("express");
const router = express.Router();
const audioDescriptionsController = require("../controllers/audioDescriptionsController");

// Routes - send request to controller where db processing is done
// get all Audio Descriptions route
router.use(express.json());
router.get(
  "/get-all-audio-descriptions",
  audioDescriptionsController.getAllAudioDescriptions
);

// get one Audio Description row route - based on id
router.get("/get-ad/:adId", audioDescriptionsController.getAudioDescription);

// get user Audio Description row - based on UserId & VideoId
router.get(
  "/get-user-ad/:videoId&:userId",
  audioDescriptionsController.getUserAudioDescription
);

router.post("/newaidescription", audioDescriptionsController.newAiDescription);

router.post("/newdescription", audioDescriptionsController.newDescription);

module.exports = router;
