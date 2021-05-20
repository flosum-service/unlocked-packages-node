const helper = require('./helper');
const constants = require('../../../constants');
const childProcess = require('../../../services/child-process');
const storage = require('../../../services/storage');

function createSnapshot(body, log) {
  return new Promise((resolve, reject) => {
    try {
      console.log('--- body', body)
      const projectName = `list_installed_packages_${new Date().getTime()}`;
      const instanceUrl = body.instanceUrl;
      const accessToken = body.accessToken;
      const packageName = body.packageName;

      Promise.resolve()
        .then(() => storage.createProjectDirectory(projectName, log))
        .then(() => storage.createSFDXProjectJSON(projectName, log))
        .then(() => storage.setInstanceUrl(projectName, instanceUrl.replace('https://', ''), log))
        .then(() => childProcess.call(constants.getSFDXRetrievePackage(accessToken, packageName), log, { cwd: `./${projectName}`, maxBuffer: 1024 * 500 }))
        .then(() => storage.unZip(`${projectName}/${constants.ZIP_PACKAGE_NAME}`, projectName, log))
        .then(resolve)
        .catch(reject)
        .then(() => storage.removeProject(projectName, log));
    } catch (e) {
      reject('Error: ' + e);
    }
  });

}

module.exports = {
  createSnapshot
}
