const { Router } = require('express');
const logger = require('../../../services/logger');
const constants = require('../../../constants');
const controller = require('./controller');

const router = new Router();

router.post('/', (req, res) => {
  const log = logger.createLog(`unpack:create:${req.headers['x-request-id']}`);
  log.log(constants.START_CREATE_UNLOCKED_PACKAGE);

  const fields = controller.checkRequiredFields(req.body);
  if (fields.length) {
    log.log(constants.REQUIRED_FIELDS_ERROR);
    return res.status(400).send({
      status: constants.ERROR,
      error: {
        message: constants.REQUIRED_FIELDS_ERROR,
        missingFields: fields,
      },
    });
  }

  if (!req.body || !req.body.componentList || !req.body.componentList.length) {
    log.log(constants.COMPONENT_LENGTH_WRONG);
    return res.status(400).send({
      status: constants.ERROR,
      error: {
        message: constants.COMPONENT_LENGTH_WRONG,
      },
    });
  }

  controller.createUnlockedPackage(req.body, log)
    .then((resBody) => {
      log.log('--- Success');
      resBody.logs = log.logs;
      return res.status(200).send(resBody);
    })
    .catch((e) => {
      log.log('--- Error');
      res.status(400).send({
        status: constants.ERROR,
        error: {
          message: e,
          logs: log.logs,
        },
      });
    });
});

module.exports = router;
