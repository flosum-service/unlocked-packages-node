const debug = require('debug');
const http = require('http');

const { configureObject } = require('./config/dotenv');
const express = require('./config/express');

// Start the Express Server using predifined configuration options
function startAPI() {
  const log = debug('unpack:api:startAPI');
  log('Starting up the Express server...');
  const app = express.configureExpress(configureObject);
  const server = http.createServer(app);
  setImmediate(() => {
    log('--- configureObject');
    log(configureObject);
    server.listen(configureObject.port, configureObject.ip, () => {
      log('Express server started in %s mode, listening to PORT: %d', configureObject.env, configureObject.port);
    });
  });
}
module.exports = {
  startAPI,
};
