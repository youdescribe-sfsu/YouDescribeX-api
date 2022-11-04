const Users = require('../models/Users');
const Participants = require('../models/Participants');
const Timing = require('../models/Timing');


// db processing is done here using sequelize models

exports.addTotalTime = async (req, res) => {
  Timing.create({
    ParticipantParticipantId: req.body.participant_id,
    total_time: req.body.time,
    
  })
    .then((user) => {
      console.log(user);
      res.status(200).send(user);
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send(err);
    });
};


