const { Router } = require('express');

const routers = new Router();

routers.use('/create', require('./create'));
routers.use('/create-version', require('./create-version'));
routers.use('/create-snapshot', require('./create-snapshot'));

module.exports = routers;
