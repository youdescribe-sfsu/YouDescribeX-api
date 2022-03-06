const { Sequelize } = require('sequelize');

const db = new Sequelize('YDXAI', 'postgres', 'password', {
  host: 'localhost',
  dialect: 'postgres',
});

// Test DB connection
db.authenticate()
  .then(() => console.log('Connected to YDXAI Database'))
  .then(() => {
    // db.sync({ alter: true })
    db.sync()
      .then((result) => {
        console.log(result);
      })
      .catch((err) => {
        console.log(err);
      });
  })
  .catch((err) => console.log('Error' + err));

module.exports = db;
