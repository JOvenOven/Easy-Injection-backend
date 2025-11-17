const config = require('config');
const debug = require('debug')('easyinjection:startup:config');

// Configuration
module.exports = function(){
    debug('Validating configuration...');
    if (!config.get('jwtPrivateKey')) {
        throw new Error('FATAL ERROR: jwtPrivateKey is not defined.');
    }
} 