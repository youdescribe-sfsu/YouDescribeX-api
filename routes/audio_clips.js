const express = require('express');
const router = express.Router();

const db = require('../db.js');
const Audio_Clips = require('../models/Audio_Clips');

router.use(express.json());
router.get('/all-audio-clips', (req, res) =>
  Audio_Clips.findAll()
    .then((audio_clips) => {
      console.log(audio_clips);
      res.sendStatus(200);
    })
    .catch((err) => console.log(err))
);

module.exports = router;
