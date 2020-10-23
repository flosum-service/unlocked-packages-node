const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const nocache = require('nocache');

const defaultRouter = require('../../routes/default-route');
const defaultRouterError = require('../../routes/default-route-error');
const createRouter = require('../../routes/create');

// Create Express server with pre-defined set of middleware
function configureExpress({ createRoot }) {
  const app = express();

  app.use(helmet());
  app.use(nocache());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  /**
   * Default route handler - provides initial request handling
   * with further request forwarding
   */
  app.use('/', defaultRouter);
  app.use(createRoot, createRouter);
  app.use('/', defaultRouterError);

  return app;
}

module.exports = {
  configureExpress,
};
