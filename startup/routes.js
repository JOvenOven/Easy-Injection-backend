const express = require('express');
const cors = require('cors');
// const users = require('../routes/users');
const register = require('../routes/register');
const verifyEmail = require('../routes/verify-email');
const login = require('../routes/login');
const auth = require('../routes/auth');
// const shows = require('../routes/shows');
const error = require('../middleware/error');

module.exports = function(app) {
    // Using middleware
    app.use(cors());
    app.use(express.json());
    // app.use('/api/users', users);
    // app.use('/api/shows', shows);
    app.use('/api/register', register);
    app.use('/api/verify-email', verifyEmail);
    app.use('/api/login', login);
    app.use('/api/auth', auth);
    app.use(error);
}