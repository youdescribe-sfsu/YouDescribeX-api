const { Sequelize, UUID } = require("sequelize");

const db = new Sequelize("ydx", "postgres", "password", {
  host: "localhost",
  port: 5000,
  dialect: "postgres",
});

// Test DB connection
db.authenticate()
  .then(() => console.log("Connected to YDXAI Database"))
  .then(() => {
    db.sync()
      .then((result) => {
        // console.log(result);
      })
      .catch((err) => {
        console.log(err);
      });
  })
  .catch((err) => console.log("Error" + err));

module.exports = db;
