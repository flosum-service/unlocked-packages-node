const dotenv = require('dotenv-safe');
const constants = require('../../constants');
// Set up default values
const configureObject = {
  env: process.env.NODE_ENV || constants.DEV_NODE_ENV,
  port: process.env.PORT || 8000,
  ip: process.env.IP || '127.0.0.1',
  createRoot: '/create',
};

const envConfigs = {
  test: {
  },
  development: {
  },
  production: {
    ip: process.env.IP || undefined,
    port: process.env.PORT || 8080,
  },
};

function configureEnv() {
  if (process.env.NODE_ENV !== 'production') {
    dotenv.config({});
  }
  Object.assign(envConfigs[configureObject.env]);
}

module.exports = {
  configureEnv,
  configureObject,
};
