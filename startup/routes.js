const express = require('express');
// const users = require('../routes/users');
// const register = require('../routes/register');
// const shows = require('../routes/shows');
// const login = require('../routes/login');
const error = require('../middleware/error');

module.exports = function(app) {
    // Using middleware
    app.use(express.json());
    // app.use('/api/users', users);
    // app.use('/api/shows', shows);
    // app.use('/api/register', register);
    // app.use('/api/login', login);
    app.use(error);
}