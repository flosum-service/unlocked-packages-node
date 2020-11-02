const { Router } = require('express');

const routers = new Router();

routers.use('/create', require('./create'));

module.exports = routers;
