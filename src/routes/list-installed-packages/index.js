const { Router } = require('express');
const logger = require('../../../services/logger');
const constants = require('../../../constants');
const controller = require('./controller');
const utils = require('../../../services/utils');

const router = new Router();

router.post('/', (req, res) => {
  const log = logger.createLog(`list-installed-packages:${req.headers['x-request-id']}`);
  log.log(constants.START_GET_INSTALLED_PACKAGES);

  const fields = utils.checkRequiredFields(req.body, constants.GET_INSTALLED_PACKAGES_REQUIRED_FIELDS);
  if (fields.length) {
    log.log(constants.REQUIRED_FIELDS_ERROR);
    const body = {
      status: constants.ERROR,
      error: {
        message: constants.REQUIRED_FIELDS_ERROR,
        missingFields: fields,
      },
    };
    log.log(body);
    return ;
  }
  controller.getInstalledPackageList(req.body, log)
    .then((result) => {
      log.log('Completed');
      res.status(200).send(result);
    })
    .catch((e) => log.log(`Error\n${e}`));
});

module.exports = router;
