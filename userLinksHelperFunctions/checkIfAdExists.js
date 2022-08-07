const Audio_Descriptions = require('../models/Audio_Descriptions');

// check if there is an existing Audio Description.. If yes, throw an error
const checkIfAdExists = async (userId, videoId) => {
  return Audio_Descriptions.findOne({
    where: {
      VideoVideoId: videoId,
      UserUserId: userId,
    },
  })
    .then((adData) => {
      if (adData === null) {
        return { message: 'Success', data: [] };
      } else {
        return {
          message: 'AudioDescription already exists for this user!!',
          data: null,
        };
      }
    })
    .catch((err) => {
      return {
        message: `Error Connecting to DB - checkIfAdExists!! Please try again. ${err}`,
        data: null,
      };
    });
};

module.exports = checkIfAdExists;
