const express = require('express');
const router = express.Router();

const notesController = require('../controllers/notesController');
router.use(express.json());

// Routes - send request to controller where db processing is done

// Post Routes - // create / update note
router.post('/post-note', notesController.postNoteByAdId);

module.exports = router;
