const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
router.use(express.json());

// Routes - send request to controller where db processing is done
// get all users route
router.get('/all-users', userController.getAllUsers);
// get one user route
router.get('/get-user/:id', userController.getUser);

module.exports = router;
