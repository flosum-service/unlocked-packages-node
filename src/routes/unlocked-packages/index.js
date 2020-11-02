const { Router } = require('express');

const routers = require('./routers');

const router = new Router();

router.use('/', routers);

module.exports = router;
