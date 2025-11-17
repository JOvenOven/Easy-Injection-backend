const mongoose = require('mongoose');
const config = require('config');
const debug = require('debug')('easyinjection:startup:db');

//Connecting to the database
module.exports = function(){ 
    const db = config.get('db');
    debug('Connecting to database');
    mongoose.connect(config.get('db'))
    .then(() => {
        debug('Database connected successfully');
        console.log(`Connected to database...`);
    })
    .catch(err => {
        debug('Database connection error: %O', err);
        console.error('Error: Could not connect to MongoDB...', err);
    });
}

