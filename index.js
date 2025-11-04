require("dotenv").config();
const express = require('express');
const app = express();
const http = require('http');
const socketService = require('./services/socketService');

require('./startup/db')();
require('./startup/routes')(app);

//Loading server on env.PORT or 3000
const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io
socketService.initialize(server);

server.listen(port, () => console.log(`Listening on port ${port}...`));

module.exports = server;
