const debug = require('debug');
const { Router } = require('express');

const constants = require('../../constants');

const router = new Router();

router.get('/', (req, res) => {
  const log = debug(`unpack:create:${req.headers['x-request-id']}`);
  log('Hello');
  return res.status(200).send('Hello World!');
});

module.exports = router;
