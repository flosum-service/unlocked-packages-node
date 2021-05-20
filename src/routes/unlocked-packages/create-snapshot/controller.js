const helper = require('./helper');
const constants = require('../../../constants');
const childProcess = require('../../../services/child-process');
const storage = require('../../../services/storage');

function createSnapshot(body, log) {
  return new Promise((resolve, reject) => {
    try {
      console.log('--- body', body)
      // const projectName = `list_installed_packages_1621514684118`;
      const projectName = `list_installed_packages_${new Date().getTime()}`;
      const instanceUrl = body.instanceUrl;
      const accessToken = body.accessToken;
      const sourceUrl = body.sourceUrl;
      const sourceAccessToken = body.sourceAccessToken;
      const packageName = body.packageName;
      const namespacePrefix = body.namespacePrefix;
      const metadataLogId = body.metadataLogId;
      const logAttachmentId = body.logAttachmentId;
      const orgId = body.orgId;

      Promise.resolve()
        .then(() => storage.createProjectDirectory(projectName, log))
        .then(() => storage.createSFDXProjectJSON(projectName, log))
        .then(() => storage.setInstanceUrl(projectName, instanceUrl.replace('https://', ''), log))
        .then(() => childProcess.call(constants.getSFDXRetrievePackage(accessToken, packageName), log, { cwd: `./${projectName}`, maxBuffer: 1024 * 500 }))
        .then(() => storage.unZip(`${projectName}/${constants.ZIP_PACKAGE_NAME}`, projectName, log))
        .then(() => helper.createZipComponents(projectName, packageName, log))
        .then((componentList) => helper.sentComponentsToFlosum(sourceUrl.replace('https://', ''), sourceAccessToken, namespacePrefix, componentList, packageName, orgId, log))
        .then(() => helper.callUpdateInfo(sourceUrl.replace('https://', ''), sourceAccessToken, metadataLogId, namespacePrefix, logAttachmentId, true, log))
        .then(() => {
          console.log('d')
        })
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
