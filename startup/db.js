const mongoose = require('mongoose');
const config = require('config');

//Connecting to the database
module.exports = function(){ 
    const db = config.get('db');
    mongoose.connect(config.get('db'))
    .then(() => console.log(`Connected to database...`))
    .catch(err => console.error('Error: Could not connect to MongoDB...', err));
}

