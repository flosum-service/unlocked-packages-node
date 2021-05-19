const debug = require('debug');

function createLog(namespace) {
  debug.enable('*');
  const log = debug(namespace);
  return {
    logs: [],
    log(text) {
      log(text);
      if (!this.logs) {
        this.logs = [];
      }
      this.logs.push(text);
    },
  };
}

module.exports = {
  createLog,
};
