const express = require('express');
const router = express.Router();
const timingController = require('../controllers/timingController');

router.use(express.json());

// Routes - send request to controller where db processing is done

router.post('/addtimedata', timingController.addTotalTime);


module.exports = router;
