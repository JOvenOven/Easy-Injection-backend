const debug = require('debug')('easyinjection:middleware:error');

module.exports = function(err, req, res, next){
    debug('Error occurred: %O', err);
    res.status(500).send('Something failed: ' + err);
}