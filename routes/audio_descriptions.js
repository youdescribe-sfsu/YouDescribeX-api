const express = require('express');
const router = express.Router();

const db = require('../db.js');
const Audio_Descriptions = require('../models/Audio_Descriptions');

router.use(express.json());
router.get('/all-Audio-Desciptions', (req, res) =>
  Audio_Descriptions.findAll()
    .then((audio_descriptions) => {
      console.log(audio_descriptions);
      res.sendStatus(200);
    })
    .catch((err) => console.log(err))
);

module.exports = router;
