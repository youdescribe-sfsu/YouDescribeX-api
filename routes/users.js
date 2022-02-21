const express = require('express');

const router = express.Router();
router.use(express.json());
router.get('/', (req, res) => res.send('USERS'));

module.exports = router;
