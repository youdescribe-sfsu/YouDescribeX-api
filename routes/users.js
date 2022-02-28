const express = require('express');
const router = express.Router();

const db = require('../config/db.js');
const User = require('../models/User');

router.use(express.json());
router.get('/all-users', (req, res) =>
  User.findAll()
    .then((users) => {
      console.log(users);
      res.sendStatus(200);
    })
    .catch((err) => console.log(err))
);

module.exports = router;
