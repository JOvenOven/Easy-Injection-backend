const express = require('express');
const cors = require('cors');
const register = require('../routes/register');
const verifyEmail = require('../routes/verify-email');
const login = require('../routes/login');
const auth = require('../routes/auth');
const user = require('../routes/user');
const error = require('../middleware/error');

module.exports = function(app) {
    // Using middleware
    app.use(cors());
    app.use(express.json());
    app.use('/api/register', register);
    app.use('/api/verify-email', verifyEmail);
    app.use('/api/login', login);
    app.use('/api/auth', auth);
    app.use('/api/user', user);
    app.use(error);
}