const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
router.use(express.json());

// Routes - send request to controller where db processing is done

module.exports = router;
