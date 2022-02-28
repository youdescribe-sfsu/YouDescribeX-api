const express = require('express');
const router = express.Router();

const db = require('../config/db.js');
const Dialog_Timestamps = require('../models/Dialog_Timestamps');

router.use(express.json());
router.get('/all-dialog-timestamps', (req, res) =>
  Dialog_Timestamps.findAll()
    .then((dialog_timestamps) => {
      console.log(dialog_timestamps);
      res.sendStatus(200);
    })
    .catch((err) => console.log(err))
);

module.exports = router;
