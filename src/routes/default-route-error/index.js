const log = require('debug')('unpack:root');
const { Router } = require('express');

const constants = require('../../constants');

const router = new Router();

// 404 error handling
router.use((req, res) => {
  log(constants.STATUS_404_ENDPOINT_NOT_FOUND);
  return res.status(404)
    .send({
      status: 'Error',
      error: {
        message: constants.STATUS_404_ENDPOINT_NOT_FOUND,
      },
    });
});

// 500 error handling
router.use((error, req, res) => {
  log(constants.STATUS_500_INTERNAL_SERVER_ERROR);
  return res.status(500)
    .send({
      status: constants.ERROR,
      error: {
        message: constants.STATUS_500_INTERNAL_SERVER_ERROR,
      },
    });
});

module.exports = router;
