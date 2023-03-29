const debug = require('debug');
const { v4: uuidv4 } = require('uuid');
const { Router } = require('express');

const utils = require('../../services/utils');
const constants = require('../../constants');

const router = new Router();

// Settings up request unique id to headers
router.use((req, res, next) => {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = Math.random().toString(16).slice(2);
  }
  next();
});

// JSON error handling
router.use((error, req, res, next) => {
  const log = debug(`unpack:root:${error.headers['x-request-id']}`);
  log(constants.STATUS_400_INVALID_JSON_ERROR);
  return req.status(400).send({
    status: constants.ERROR,
    error: {
      message: constants.STATUS_400_INVALID_JSON_ERROR,
    },
  });
});

// Default request handling
router.use((req, res, next) => {
  const log = debug(`unpack:root:${req.headers['x-request-id']}`);
  log('reqPath: %s', utils.removeSensitiveData(req.path));
  log('reqHeaders:\n%o', utils.removeSensitiveData(req.headers));
  log('reqParams:\n%o', utils.removeSensitiveData(req.params));
  log('reqQuery:\n%o', utils.removeSensitiveData(req.query));
  log('reqBody:\n%o', utils.removeSensitiveData(req.body));
  log('resHeaders:\n%o', utils.removeSensitiveData(res.getHeaders()));
  next();
});
module.exports = router;
