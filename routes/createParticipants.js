const express = require('express');
const router = express.Router();
const createParticipantsController = require('../controllers/createParticipantsController'); // routes for user links creation

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

//POST Requests
// add a new user
router.post('/add-new-participant', createParticipantsController.addNewParticipant);

router.get(
    '/get-participant/:participantId',
    createParticipantsController.getParticipantById
  );

// add a new Audio Description & Audio Clips
// router.post('/create-new-user-ad', createUserLinksController.createNewUserAd);

module.exports = router;