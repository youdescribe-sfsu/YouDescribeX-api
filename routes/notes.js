const express = require('express');
const router = express.Router();

const db = require('../config/db.js');
const Notes = require('../models/Notes');

router.use(express.json());
router.get('/all-notess', (req, res) =>
  Notes.findAll()
    .then((notes) => {
      console.log(notes);
      res.sendStatus(200);
    })
    .catch((err) => console.log(err))
);

module.exports = router;
