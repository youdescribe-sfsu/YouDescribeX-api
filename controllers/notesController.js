const Notes = require('../models/Notes');

// db processing is done here using sequelize models

// GET Requests
// find all Notess
exports.getAllNotes = async (req, res) => {
  Notes.findAll()
    .then((allNotes) => {
      console.log(allNotes);
      return res.send(allNotes);
    })
    .catch((err) => console.log(err));
};

// find one Notes - based on notes_id
exports.getNoteById = async (req, res) => {
  Notes.findOne({
    where: {
      notes_id: req.params.id,
    },
  })
    .then((note) => {
      console.log(note);
      return res.send(note);
    })
    .catch((err) => {
      console.log(err);
    });
};

// find one Notes - based on adid
exports.getNoteByAdId = async (req, res) => {
  Notes.findOne({
    where: {
      AudioDescriptionAdId: req.params.adId,
    },
  })
    .then((note) => {
      console.log(note);
      return res.send(note);
    })
    .catch((err) => {
      console.log(err);
    });
};

// POST Requests
// post new Note - based on adid
// check if there exists a record, if yes update it, otherwise, create a new note record
exports.postNoteByAdId = async (req, res) => {
  Notes.findOne({
    where: {
      AudioDescriptionAdId: req.body.adId,
    },
  })
    .then((obj) => {
      if (obj) {
        obj
          .update({ notes_text: req.body.notes })
          .then((note) => {
            console.log(note);
            return res.send(note);
          })
          .catch((err) => {
            console.log(err);
            return res.send(err);
          });
      } else {
        Notes.create({
          AudioDescriptionAdId: req.body.adId,
          notes_text: req.body.notes,
        })
          .then((note) => {
            console.log(note);
            return res.send(note);
          })
          .catch((err) => {
            console.log(err);
            return res.send(err);
          });
      }
    })
    .catch((err) => {
      console.log(err);
      return res.send(err);
    });
};
