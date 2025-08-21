const express = require('express');
const app = express();

require('./startup/routes')(app);

//Loading server on env.PORT or 3000
const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`Listening on port ${port}...`));

module.exports = server;
