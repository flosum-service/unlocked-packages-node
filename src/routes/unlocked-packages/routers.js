const { Router } = require('express');

const routers = new Router();

routers.use('/create', require('./create'));
routers.use('/update', require('./update'));

module.exports = routers;
