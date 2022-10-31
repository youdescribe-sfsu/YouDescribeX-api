const Users = require('../models/Users');
const Participants = require('../models/Participants');
const Audio_Descriptions = require('../models/Audio_Descriptions');
const Audio_Clips = require('../models/Audio_Clips');
const getAIUserId = require('../userLinksHelperFunctions/getAIUserId');
const getVideoFromYoutubeId = require('../audioClipHelperFunctions/getVideoFromYoutubeId'); // get the video id by youtubeId
const checkIfAdExists = require('../userLinksHelperFunctions/checkIfAdExists');

// db processing is done here using sequelize models

// add new user
exports.addNewParticipant = async (req, res) => {
  Participants.create({
    participant_name: req.body.name,
    participant_email: req.body.email,
    youtube_video_id_with_AI: req.body.youtubeVideoIdWithAi,
    youtube_video_id_without_AI: req.body.youtubeVideoIdWithoutAi,
    user_id_with_AI: req.body.userIdWithAi,
    user_id_without_AI: req.body.userIdWithoutAi,
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

exports.getParticipantById = async (req, res) => {
     
  Participants.findByPk(req.params.participantId)
  .then(data => {
    if (data) {
      res.send(data);
    } else {
      res.status(404).send({
        message: `Cannot find participant with id=${participantId}.`
      });
    }
  })
  .catch(err => {
    res.status(500).send({
      message: "Error retrieving Tutorial with id=" + participantId
    });
  });

};
