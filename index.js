require("dotenv").config();
const express = require('express');
//const passport = require('passport');
const app = express();
const http = require('http');
const path = require('path');
const socketService = require('./src/services/socket.service');

//require('./src/config/passport');
require('./src/config/database')();

app.set('trust proxy', true);

//app.use(passport.initialize());

require('./src/config/routes')(app);

const angularDistPath = path.join(__dirname, './dist/frontend/browser');

app.use(express.static(angularDistPath));
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(angularDistPath, 'index.html'));
});

const port = process.env.PORT || 3000;
const server = http.createServer(app);

socketService.initialize(server);

server.listen(port, () => console.log(`Listening on port ${port}...`));

module.exports = server;
