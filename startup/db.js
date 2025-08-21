const mongoose = require('mongoose');
const config = require('config');

//Connecting to the database
module.exports = function(){ 
    const db = config.get('db');
    mongoose.connect(config.get('db'), {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log(`Connected to ${db}...`))
    .catch(err => console.error('Error: Could not connect to MongoDB...', err));
}

