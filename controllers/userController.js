const Users = require('../models/Users');

// db processing is done here using sequelize models

// find all users
exports.getAllUsers = async (req, res) => {
  Users.findAll()
    .then((allUsers) => {
      console.log(allUsers);
      return res.send(allUsers);
    })
    .catch((err) => console.log(err));
};

// find one user
exports.getUser = async (req, res) => {
  Users.findAll({
    where: {
      user_id: req.params.id,
    },
  })
    .then((users) => {
      console.log(users);
      return res.send(users);
    })
    .catch((err) => {
      console.log(err);
    });
};
