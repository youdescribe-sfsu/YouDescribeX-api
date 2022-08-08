const Notes = require('../models/Notes');

// db processing is done here using sequelize models

// POST Requests
// post new Note - based on adid
// check if there exists a record, if yes update it, otherwise, create a new note record
exports.postNoteByAdId = async (req, res) => {
  if (req.body.noteId === '') {
    // create new note if there is no noteId
    Notes.create({
      notes_text: req.body.notes,
      AudioDescriptionAdId: req.body.adId,
    })
      .then((note) => {
        // console.log(note);
        res.status(200).send(note);
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send(err);
      });
  } else {
    // update the note if there is noteId is mentioned
    Notes.update(
      { notes_text: req.body.notes },
      {
        where: {
          AudioDescriptionAdId: req.body.adId,
        },
        returning: true, // returns the updated row
        plain: true, // returns only the object & not the messy data
      }
    )
      .then(([count, note]) => {
        // returns the number of affected rows & actual data values
        // console.log(note);
        res.status(200).send(note);
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send(err.message);
      });
  }
};
