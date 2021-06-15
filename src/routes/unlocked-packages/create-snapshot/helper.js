const fs = require('fs');
const constants = require('../../../constants');
const parser = require('xml2json');
const http = require('../../../services/http');
const childProcess = require('../../../services/child-process');
const { MetadataTypeParser } = require('./metadataTypeParser');


function getComponentTypesFromPackageXML(projectPath, packageName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Get Component Types From PackageXML');
      const packageXML = fs.readFileSync(`${projectPath}/${packageName}/package.xml`);
      const packageJSON = JSON.parse(parser.toJson(packageXML));

      const packageTypeList = [];

      if (!Array.isArray(packageJSON.Package.types)) {
        packageJSON.Package.types = [packageJSON.Package.types];
      }

      packageJSON.Package.types.forEach((type) => packageTypeList.push(createComponents(type)));

      log.log('Count Of Component Types: ' + packageTypeList.length);
      resolve(packageTypeList);
      log.log('End Get Component Types From PackageXML');
    } catch (e) {
      log.log('Error Get Component Types From PackageXML ' + e);
      reject(e);
    }
  });
}

function getMetadataInfo(accessToken, projectName, packageTypeList, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Get Metadata Info');
      const metadataInfoMap = {};
      let promiseChain = Promise.resolve();
      packageTypeList.forEach((componentType) => {
        promiseChain = promiseChain
          .then(() => childProcess.call(
            constants.getSFDXMetadataInfo(componentType.type, accessToken),
            log,
            { cwd: `./${projectName}`, maxBuffer: 1024 * 8000 },
            false,
            false
            ))
          .then((metadataInfo) => {
            log.log('Received Metadata Info, ' + componentType.type);
            metadataInfoMap[componentType.type] = JSON.parse(metadataInfo)
          });
      });

      promiseChain
        .then(() => {
          log.log('End Get Metadata Info');
          resolve({ metadataInfoMap, packageTypeList });
        })
        .catch((e) => {
          log.log('Start Get Metadata Info ' + e);
          reject(e);
        });
    } catch (e) {
      log.log('Start Get Metadata Info ' + e);
      reject(e);
    }
  });
}

function mergeComponentsWithMetadataInfo(metadataInfoMap, packageTypeList, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Merge Components With MetadataInfo');
      packageTypeList.forEach((componentType) => {
        const metadataInfoType = metadataInfoMap[componentType.type];
        if (metadataInfoType && metadataInfoType.result && metadataInfoType.result.length) {
          componentType.componentList.forEach((component) => {
            const metadataInfo = metadataInfoType.result.find((metadataInfo) => metadataInfo.fullName === component.apiName);
            if (metadataInfo) {
              component.lastModifiedDate = metadataInfo.lastModifiedDate;
              component.lastModifiedBy = metadataInfo.lastModifiedByName;
            }
          });
        }
      });

      resolve(packageTypeList);
      log.log('End Merge Components With MetadataInfo');
    } catch (e) {
      log.log('Error Merge Components With MetadataInfo ' + e);
      reject(e);
    }
  });
}

function createZipComponents(projectPath, packageName, packageTypeList, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Create Zip Components');

      const metadataTypeParser = new MetadataTypeParser(packageTypeList, projectPath, packageName, log);
      const chunkList = metadataTypeParser.parseMetadata(log);

      resolve(chunkList);
      log.log('End Create Zip Components');
    } catch (e) {
      log.log('Error Create Zip Components ' + e);
      reject(e);
    }
  });
}

function createComponents(type) {
  const componentList = [];
  if (typeof type.members === 'string') {
    componentList.push({
      apiName: type.members,
      componentType: type.name,
      fileList: []
    });
  } else {
    type.members.forEach((member) => {
      componentList.push({
        apiName: member,
        componentType: type.name,
        fileList: []
      });
    });
  }
  return { componentList, type: type.name };
}

function sendComponents(flosumUrl, flosumToken, namespacePrefix, chunkList, packageName, snapshotName, orgId, metadataLogId, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Send Components');
      let snapshotId = '';
      let promiseChain = Promise.resolve();
      for (let i = 0; i < chunkList.length; i++) {
        if (i === 0) {
          promiseChain = promiseChain
            .then(() => callCreateSnapshot(flosumUrl, flosumToken, namespacePrefix, chunkList[i], packageName, snapshotName, orgId, metadataLogId, log))
            .then((res) => snapshotId = res);
        } else {
          promiseChain = promiseChain.then(() => callSentComponents(flosumUrl, flosumToken, namespacePrefix, chunkList[i], packageName, snapshotId, orgId, log));
        }
      }

      promiseChain.then(() => {
        log.log(`End Send Components`);
        resolve();
      })
        .catch((e) => {
          log.log('Error Send Components ' + e);
          reject(e);
        });

    } catch (e) {
      log.log('Error Send Components ' + e);
      reject(e);
    }
  });
}

function callCreateSnapshot(flosumUrl, flosumToken, namespacePrefix, chunk, packageName, snapshotName, orgId, metadataLogId, log) {
  return new Promise((resolve, reject) => {
    try {
      const resBody = { packageName, typeList: chunk.typeList, orgId, snapshotName, metadataLogId };
      const body = { methodType: constants.METHOD_TYPE_CREATE_SNAPSHOT, body: JSON.stringify(resBody) };
      http.post(flosumUrl, flosumToken, namespacePrefix.replace('__', ''), JSON.stringify(body))
        .then((res) => {
          resolve(res.data);
          if (res.data === 'Wrong method type') {
            log.log('You have an old version of the Flosum package, please update.');
            reject();
          }
        })
        .catch((error) => {
          reject(error);
        });
    } catch (e) {
      reject(e);
    }
  });
}

function callSentComponents(flosumUrl, flosumToken, namespacePrefix, chunk, packageName, snapshotId, orgId, log) {
  return new Promise((resolve, reject) => {
    try {
      const resBody = { packageName, typeList: chunk.typeList, orgId, snapshotId };
      const body = { methodType: constants.METHOD_TYPE_ADD_COMPONENTS_TO_SNAPSHOT, body: JSON.stringify(resBody) };
      http.post(flosumUrl, flosumToken, namespacePrefix.replace('__', ''), JSON.stringify(body))
        .then(() => {
          resolve()
        })
        .catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

function callUpdateInfo(flosumUrl, flosumToken, logId, nameSpacePrefix, attachmentLogId, isSuccess, log, isError = false) {
  return new Promise((resolve, reject) => {
    try {
      nameSpacePrefix = (nameSpacePrefix && nameSpacePrefix.length) ? nameSpacePrefix.replace('__', '') : '';
      log.log(`Start Update Log is Success = ${isSuccess}`);
      const resBody = {
        logId,
        attachmentLogId,
        isJobCompleted: true,
        status: isSuccess ? 'Completed' : 'Exception',
        isSuccess,
        isError,
        attachmentBody: `Create Snapshot From Unlocked Package:\n\nFull Process:\n\n${log.logs.join('\n')}`,
      };
      const body = { methodType: constants.METHOD_UPDATE_LOG, body: JSON.stringify(resBody) };
      http.post(flosumUrl, flosumToken, nameSpacePrefix, body)
        .then(() => {
          log.log(`End Update Log`);
          resolve();
        })
        .catch((error) => {
          log.log(`Error Update Log`);
          reject(error);
        });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  getComponentTypesFromPackageXML,
  getMetadataInfo,
  mergeComponentsWithMetadataInfo,
  createZipComponents,
  sendComponents,
  callUpdateInfo
}
