const Users = require('../models/Users');

// find AI user Id
const getAIUserId = async () => {
  return Users.findOne({
    where: {
      is_ai: true,
    },
  })
    .then((user) => {
      return { message: 'Success', data: user.user_id };
    })
    .catch((err) => {
      return {
        message: `Error Connecting to DB - getAIUserId!! Please try again. ${err}`,
        data: null,
      };
    });
};

module.exports = getAIUserId;
