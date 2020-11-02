const fs = require('fs');
const helper = require('./helper');
const constants = require('../../../constants');

function createUnlockedPackage(body, log) {
  const resBody = {};
  return new Promise((resolve, reject) => {
    const projectName = `${body.orgId}_${body.userId}_${body.timestamp}`;
    log.log('Start Create Unlocked Package');
    Promise.resolve()
      .then(() => helper.checkProjectDirectory(projectName)
        .then((isExist) => {
          if (isExist) {
            reject(constants.PROJECT_DIRECTORY_IS_EXIST);
          } else {
            return helper.callChildProcess(constants.getSFDXCreateProject(projectName), log);
          }
        }))
      .then(() => helper.callComponentList(body.domain, body.sessionId, body.componentList.map((comp) => comp.id), log))
      .then((result) => helper.convertToBuffer(result, log))
      .then((bufferList) => helper.unzipComponentList(bufferList, projectName, log))
      .then(() => helper.generatePackageXML(body.componentList, projectName, log))
      .then(() => helper.callChildProcess(
        constants.getSFDXConvertMetadata(`./${constants.UNZIP_CATALOG_NAME}`),
        log,
        { cwd: `./${projectName}`, maxBuffer: 1024 * 500 },
      ))
      .then(() => helper.callChildProcess(
        constants.getSFDXCreateUnlockedPackage(body.packageName, body.username, body.description),
        log,
        { cwd: `./${projectName}`, maxBuffer: 1024 * 500 },
        true,
      ))
      .then((result) => {
        if (result === constants.PACKAGE_WITH_THIS_NAME_IS_EXIST) {
          log.log(constants.PACKAGE_WITH_THIS_NAME_IS_EXIST);
          return helper.addExistProjectToSFDXProject(projectName, body.packageName, log);
        }
        log.log('SFDX Unlocked Package Created');
        log.log(result.stdout);
        return Promise.resolve();
      })
      .then(() => helper.callChildProcess(
        constants.getSFDXCreateUnlockedPackageVersion(body.packageName, body.username, body.versionKey, body.versionName, body.description, body.versionNumber),
        log,
        { cwd: `./${projectName}`, maxBuffer: 1024 * 500 },
      ))
      .then((stdout) => {
        stdout = ' Request in progress. Sleeping 30 seconds. Will wait a total of 600 more seconds before timing out. Current Status=\'Initializing\'\n Request in progress. Sleeping 30 seconds. Will wait a total of 570 more seconds before timing out. Current Status=\'Verifying metadata\'\n sfdx-project.json has been updated.\n Successfully created the package version [08c2w000000k9zUAAQ]. Subscriber Package Version Id: 04t2w000009F4ILAA0\n Package Installation URL: https://login.salesforce.com/packaging/installPackage.apexp?p0=04t2w000009F4ILAA0\n As an alternative, you can use the "sfdx force:package:install" command.';
        log.log('SFDX Unlocked Package Version Created');
        log.log(stdout);
        return helper.getInstallationURL(stdout);
      })
      .then((installationURL) => {
        resBody.installationURL = installationURL;
        return Promise.resolve();
      })
      .then(() => helper.getSFDXProject(projectName))
      .then((sfdxProject) => {
        resBody.sfdxProject = sfdxProject;
        resolve(resBody);
      })
      // .then(() => helper.removeProject(projectName, log))
      .catch((e) => reject(e));
    // .then(() => helper.removeProject(projectName, log));
  });
}

function checkRequiredFields(body) {
  if (!body) {
    return constants.CREATE_PACKAGE_REQUIRED_FIELDS;
  }
  const missingRequiredFieldList = [];
  constants.CREATE_PACKAGE_REQUIRED_FIELDS.forEach((field) => {
    if (!body[field]) {
      missingRequiredFieldList.push(field);
    }
  });
  return missingRequiredFieldList;
}

module.exports = {
  createUnlockedPackage,
  checkRequiredFields,
};
