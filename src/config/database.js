const mongoose = require('mongoose');
require('dotenv').config();

module.exports = function(){ 
    const db = process.env.EASYINJECTION_DB;
    mongoose.connect(db)
        .then(() => {
            console.log('Connected to database');
            
        })
        .catch(err => {
            console.log('Error connecting to database', err);
        });
}

