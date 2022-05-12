const User = require("../models/User");

// db processing is done here using sequelize models

// find all users
exports.getAllUsers = async (req, res) => {
  User.findAll()
    .then((allUsers) => {
      console.log(allUsers);
      return res.send(allUsers);
    })
    .catch((err) => console.log(err));
};

// find one user
exports.getUser = async (req, res) => {
  User.findAll({
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
