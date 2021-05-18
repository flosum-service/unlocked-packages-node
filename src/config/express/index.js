const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const nocache = require('nocache');

const defaultRouter = require('../../routes/default-route');
const defaultRouterError = require('../../routes/default-route-error');
const getInstalledPackages = require('../../routes/get-installed-packages');
const unlockedPackagesRouter = require('../../routes/unlocked-packages');

// Create Express server with pre-defined set of middleware
function configureExpress({ unlockedPackages }) {
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
  app.use('/', getInstalledPackages);
  app.use(unlockedPackages, unlockedPackagesRouter);
  app.use('/', defaultRouterError);

  return app;
}

module.exports = {
  configureExpress,
};
