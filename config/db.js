const { Sequelize, UUID } = require('sequelize');

const db = new Sequelize(
  process.env.DATABASE,
  process.env.UNAME,
  process.env.DBPASSWORD,
  {
    host: process.env.HOST,
    port: process.env.DBPORT,
    dialect: 'postgres',
  }
);

// Test DB connection
db.authenticate()
  .then(() => console.log('Connected to YDXAI Database'))
  .then(() => {
    // db.sync({ alter: true })
    db.sync({ logging: false })
      .then((result) => {
        // console.log(result);
      })
      .catch((err) => {
        console.log(err);
      });
  })
  .catch((err) => console.log('Error' + err));

module.exports = db;
