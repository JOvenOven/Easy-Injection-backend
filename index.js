require("dotenv").config();
const express = require('express');
const app = express();
const http = require('http');
const socketService = require('./services/socketService');
const debug = require('debug')('easyinjection:server');

console.log('========================================');
console.log('STARTING EASYINJECTION BACKEND SERVER');
console.log('========================================');

debug('Loading database connection...');
require('./startup/db')();
debug('Database connection loaded');

debug('Loading routes...');
require('./startup/routes')(app);
debug('Routes loaded');

//Loading server on env.PORT or 3000
const port = process.env.PORT || 3000;
console.log('Creating HTTP server...');
const server = http.createServer(app);
console.log('HTTP server created');

debug('Initializing Socket.io service...');
console.log('Initializing Socket.io service...');
// Initialize Socket.io
socketService.initialize(server);
console.log('Socket.io service initialized');

console.log(`Starting server on port ${port}...`);
server.listen(port, () => {
    debug('Server started on port %d', port);
    console.log('========================================');
    console.log(`✓ Server listening on port ${port}`);
    console.log('✓ Socket.io ready for connections');
    console.log('========================================');
});

module.exports = server;
