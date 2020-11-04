const helper = require('./helper');
const constants = require('../../../constants');

function devMode(body, projectName, resBody, log) {
  return Promise.resolve()
    .then(() => helper.callChildProcess(
      constants.getSFDXCreateUnlockedPackage(body.packageName, body.sessionId, body.description),
      log,
      { cwd: `./${projectName}`, maxBuffer: 1024 * 500 },
      true,
    ))
    .then((stdout) => {
      if (stdout === constants.PACKAGE_WITH_THIS_NAME_IS_EXIST) {
        log.log(constants.PACKAGE_WITH_THIS_NAME_IS_EXIST);
        return Promise.reject(constants.PACKAGE_NAME_MUST_BE_UNIQUE);
      }
      log.log('SFDX Unlocked Package Created');
      log.log(stdout);
      return Promise.resolve();
    })
    .then(() => helper.callChildProcess(
      constants.getSFDXCreateUnlockedPackageVersion(body.packageName, body.sessionId, body.versionKey, body.versionName, body.description, body.versionNumber),
      log,
      { cwd: `./${projectName}`, maxBuffer: 1024 * 500 },
    ));
}

function createUnlockedPackage(body, log) {
  const resBody = {
    tempLogId: body.tempLogId,
    unlockedPackageId: body.unlockedPackageId,
  };
  return new Promise((resolve, reject) => {
    const projectName = `${body.orgId}_${body.userId}_${body.timestamp}`;
    Promise.resolve()
      .then(() => helper.checkProjectDirectory(projectName)
        .then((isExist) => {
          if (isExist) {
            reject(constants.PROJECT_DIRECTORY_IS_EXIST);
          } else {
            return helper.callChildProcess(constants.getSFDXCreateProject(projectName), log);
          }
        }))
      .then(() => helper.setInstanceUrl(projectName, body.domain, log))
      .then(() => helper.callComponentList(body.domain, body.sessionId, body.componentList.map((comp) => comp.id), body.componentList.length, log))
      .then((result) => helper.convertToBuffer(result, log))
      .then((bufferList) => helper.unzipComponentList(bufferList, projectName, body.sourceObjectName, log))
      .then(() => helper.generatePackageXML(body.componentList, projectName, log))
      .then(() => helper.callChildProcess(
        constants.getSFDXConvertMetadata(`./${constants.UNZIP_CATALOG_NAME}`),
        log,
        { cwd: `./${projectName}`, maxBuffer: 1024 * 500 },
      ))
      .then(() => {
        if (process.env.MODE !== 'TEST') {
          log.log('Dev Mode');
          return devMode(body, projectName, resBody, log);
        }
        log.log('Test Mode');
        return Promise.resolve();
      })
      .then(() => helper.getSFDXProject(projectName, log))
      .then((sfdxProject) => {
        resBody.sfdxProject = JSON.stringify(sfdxProject);
        resBody.status = 'Completed';
        if (sfdxProject.packageAliases) {
          return helper.getInstallationURL(sfdxProject, body.packageName, log);
        }
        return Promise.resolve('');
      })
      .then((installationURL) => {
        resBody.installationURL = installationURL;
        return Promise.resolve();
      })
      .then(() => {
        log.log('End Create Unlocked Package');
        helper.callUpdateInfo(resBody, body.domain, body.sessionId, log)
          .then(() => resolve())
          .catch((e) => reject(e));
      })
      .then((r) => resolve(r))
      .then(() => helper.removeProject(projectName, log))
      .catch((e) => {
        let error = 'Error';
        if (e) {
          error = e.toString();
        }
        resBody.status = 'Error';
        resBody.error = error;
        log.log('Error Create Unlocked Package');
        log.log(error);
        return helper.callUpdateInfo(resBody, body.domain, body.sessionId, log)
          .then(() => reject(e))
          .catch((e1) => reject(e1));
      })
      .then(() => helper.removeProject(projectName, log));
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
