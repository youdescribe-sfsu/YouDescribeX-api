const express = require('express');
const router = express.Router();

const notesController = require('../controllers/notesController');
router.use(express.json());

// Routes - send request to controller where db processing is done
// get all Notes route
router.get('/all-Notes', notesController.getAllNotes);
// get one Note route - based on notes_id
router.get('/get-note-byId/:id', notesController.getNoteById);
// get one Note route - based on AdId
router.get('/get-note-byAdId/:adId', notesController.getNoteByAdId);

// Post Routes
router.post('/post-note', notesController.postNoteByAdId);

module.exports = router;
