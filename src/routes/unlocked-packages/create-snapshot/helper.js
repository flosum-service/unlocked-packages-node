const fs = require('fs');
const constants = require('../../../constants');
const parser = require('xml2json');
const http = require('../../../services/http');
const { MetadataTypeParser } = require('./metadataTypeParser');

function createZipComponents(projectPath, packageName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Create Zip Components');

      const packageXML = fs.readFileSync(`${projectPath}/${packageName}/package.xml`);
      const packageJSON = JSON.parse(parser.toJson(packageXML));

      const packageTypeList = [];

      if (!Array.isArray(packageJSON.Package.types)) {
        packageJSON.Package.types = [packageJSON.Package.types];
      }

      packageJSON.Package.types.forEach((type) => packageTypeList.push(createComponents(type)));

      const metadataTypeParser = new MetadataTypeParser(packageTypeList, projectPath, packageName, log);
      const chunkList = metadataTypeParser.parseMetadata(log);

      resolve(chunkList);
      log.log('End Create Zip Components');
    } catch (e) {
      log.log('Error Create Zip Components');
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

function sendComponents(flosumUrl, flosumToken, namespacePrefix, chunkList, packageName, snapshotName, orgId, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Send Components');
      let snapshotId = '';
      let promiseChain = Promise.resolve();
      for (let i = 0; i < chunkList.length; i++) {
        if (i === 0) {
          promiseChain = promiseChain
            .then(() => callCreateSnapshot(flosumUrl, flosumToken, namespacePrefix, chunkList[i], packageName, snapshotName, orgId, log))
            .then((res) => snapshotId = res);
        } else {
          promiseChain = promiseChain.then(() => callSentComponents(flosumUrl, flosumToken, namespacePrefix, chunkList[i], packageName, snapshotId, orgId, log));
        }
      }

      promiseChain.then(() => {
        log.log(`End Send Components`);
        resolve();
      })
        .catch(reject);

    } catch (e) {
      log.log('Error Send Components');
      reject(e);
    }
  });
}

function callCreateSnapshot(flosumUrl, flosumToken, namespacePrefix, chunk, packageName, snapshotName, orgId, log) {
  return new Promise((resolve, reject) => {
    try {
      const resBody = { packageName, typeList: chunk.typeList, orgId, snapshotName };
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
  createZipComponents,
  sendComponents,
  callUpdateInfo
}
