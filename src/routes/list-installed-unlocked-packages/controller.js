const helper = require('./helper');
const constants = require('../../constants');
const childProcess = require('../../services/child-process');
const storage = require('../../services/storage');
const http = require('../../services/http');

function getInstalledPackageList(body, log) {
  return new Promise((resolve, reject) => {
    try {
      const projectName = `list_installed_packages_${new Date().getTime()}`;
      const instanceUrl = body.instanceUrl;
      const accessToken = body.accessToken;
      const withDependencies = body.withDependencies;

      Promise.resolve()
        .then(() => helper.callInstalledUnlockedPackages(instanceUrl, accessToken, withDependencies, log))
        .then((parsedPackageList) => {
          if (withDependencies) {
            return helper.getDependencyPackages(instanceUrl, accessToken, parsedPackageList, log);
          } else {
            return Promise.resolve(parsedPackageList);
          }
        })
        .then(resolve)
        .catch(reject)
    } catch (e) {
      reject('Error: ' + e);
    }
  });

}

module.exports = {
  getInstalledPackageList
}
