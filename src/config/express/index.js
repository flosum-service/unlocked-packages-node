const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const nocache = require('nocache');

const defaultRouter = require('../../routes/default-route');
const defaultRouterError = require('../../routes/default-route-error');
const listInstalledUnlockedPackages = require('../../routes/list-installed-unlocked-packages');
const listInstalledPackages = require('../../routes/list-installed-packages');
const listCreatedPackages = require('../../routes/list-created-packages');
const unlockedPackagesRouter = require('../../routes/unlocked-packages');

// Create Express server with pre-defined set of middleware
function configureExpress({ unlockedPackages }) {
  const app = express();

  app.use(helmet());
  app.use(nocache());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json({ limit: '5mb' }));

  /**
   * Default route handler - provides initial request handling
   * with further request forwarding
   */
  app.use('/', defaultRouter);
  app.use('/list-installed-packages', listInstalledPackages);
  app.use('/list-installed-unlocked-packages', listInstalledUnlockedPackages);
  app.use('/list-created-packages', listCreatedPackages);
  app.use(unlockedPackages, unlockedPackagesRouter);
  app.use('/', defaultRouterError);

  return app;
}

module.exports = {
  configureExpress,
};
