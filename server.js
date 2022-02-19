const express = require('express');
const cors = require('cors');

//database
const db = require('./db');
// Test DB connection
db.authenticate()
  .then(() => console.log('Connected to YDXAI Database'))
  .catch((err) => console.log('Error' + err));

const app = express();
app.use(cors());
app.use(express.json());

port = 4000;
app.listen(port, () => console.log(`YDX Backend server on port ${port}!`));
