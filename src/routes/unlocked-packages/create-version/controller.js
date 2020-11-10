const helper = require('./helper');
const constants = require('../../../constants');

function devMode(body, projectName, resBody, log) {
  return Promise.resolve();
}

function createUnlockedPackageVersion(body, log) {
  return new Promise((resolve, reject) => {
    const projectName = `${body.orgId}_${body.userId}_${body.timestamp}`;
    const resBody = {
      unlockedPackageVersionTempLogId: body.unlockedPackageTempLogId,
      unlockedPackageId: body.unlockedPackageId,
      unlockedPackageVersionId: body.unlockedPackageVersionId,
    };
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
      .then((result) => helper.mergeAttachmentAndComponents(body.componentList, result, log))
      .then((result) => helper.convertToBuffer(result, log))
      .then((componentList) => helper.unzipComponentList(componentList, projectName, body.sourceObjectName, log))
      .then(() => helper.generatePackageXML(body.componentList, projectName, log))
      .then(() => helper.callChildProcess(
        constants.getSFDXConvertMetadata(`./${constants.UNZIP_CATALOG_NAME}`),
        log,
        { cwd: `./${projectName}`, maxBuffer: 1024 * 500 },
      ))
      .then(() => helper.addSFDXPackage(projectName, body.sfdxProject, log))
      .then(() => {
        if (process.env.MODE !== 'TEST') {
          log.log('Dev Mode');
          return helper.callChildProcess(
            constants.getSFDXCreateUnlockedPackageVersion(body.packageName, body.sessionId, body.versionKey, body.versionName, body.description, body.versionNumber),
            log,
            { cwd: `./${projectName}`, maxBuffer: 1024 * 500 },
          );
        }
        log.log('Test Mode');
        return Promise.resolve();
      })
      .then(() => helper.getSFDXProject(projectName, log))
      .then((sfdxProject) => {
        resBody.sfdxProject = JSON.stringify(sfdxProject);
        resBody.status = 'Completed';
        if (sfdxProject.packageAliases) {
          return helper.getInstallationURL(sfdxProject, body.packageName, body.versionNumber, log);
        }
        return Promise.resolve('');
      })
      .then((installationURL) => {
        resBody.installationURL = installationURL;
        return Promise.resolve();
      })
      .then(() => {
        log.log('End Create Unlocked Package Version');
        resBody.logs = JSON.stringify(log.logs);
        helper.callUpdateInfo(resBody, body.domain, body.sessionId, log)
          .then(() => resolve())
          .catch((e) => reject(e));
      })
      .then((response) => resolve(response))
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

module.exports = {
  createUnlockedPackageVersion,
};
