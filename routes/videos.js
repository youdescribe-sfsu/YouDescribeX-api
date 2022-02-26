const express = require('express');
const router = express.Router();

const db = require('../db.js');
const Video = require('../models/Video');

router.use(express.json());
router.get('/all-videos', (req, res) =>
  Video.findAll()
    .then((videos) => {
      console.log(videos);
      res.sendStatus(200);
    })
    .catch((err) => console.log(err))
);

module.exports = router;
