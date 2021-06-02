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

      Promise.resolve()
        .then(() => storage.createProjectDirectory(projectName, log))
        .then(() => storage.createSFDXProjectJSON(projectName, log))
        .then(() => storage.setInstanceUrl(projectName, instanceUrl.replace('https://', ''), log))
        .then(() => http.callToolingAPIRequest(instanceUrl, accessToken, constants.QUERY_INSTALLED_PACKAGE_LIST, log))
        .then((packageList) => helper.parseInstalledUnlockedPackageList(packageList, log))
        .then(resolve)
        .catch(reject)
        .then(() => storage.removeProject(projectName, log));
    } catch (e) {
      reject('Error: ' + e);
    }
  });

}

module.exports = {
  getInstalledPackageList
}
