const fs = require('fs');
const constants = require('../../../constants');
const parser = require('xml2json');
const AdmZip = require('adm-zip');
const http = require('../../../services/http');

function createZipComponents(projectPath, packageName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('*** Start Create Zip Components');

      const packageXML = fs.readFileSync(`${projectPath}/${packageName}/package.xml`);
      const packageJSON = JSON.parse(parser.toJson(packageXML));

      const packageTypeList = [];

      if (!Array.isArray(packageJSON.Package.types)) {
        packageJSON.Package.types = [packageJSON.Package.types];
      }

      packageJSON.Package.types.forEach((type) => packageTypeList.push(createComponents(type)));

      let count = 0;
      let chunkCounter = 0;
      let componentList = [];
      let zip = new AdmZip();
      let size = 0;
      const chunkList = [{ typeList: [] }];
      packageTypeList.forEach((type) => {
        const folderType = constants.METADATA_FOLDER_TYPE_MAP[type.type];
        if (folderType && fs.existsSync(`${projectPath}/${packageName}/${folderType}`)) {
          const typePath = `${projectPath}/${packageName}/${folderType}`;
          const folderContentList = fs.readdirSync(
            typePath,
            { withFileTypes: true }
          );

          if (type.type !== 'CustomField') {
            type.componentList.forEach((component) => {
              folderContentList.forEach((content) => {
                if (content.name.split('.')[0] === component.apiName) {
                  component.fileList.push(content.name);
                  component.isDirectory = content.isDirectory();
                  if (!content.name.includes('-meta.xml')) {
                    component.label = `${folderType}/${content.name}`;
                  }
                }
              });
            });


            type.componentList.forEach((component) => {
              componentList.push(component);
              count++;
              component.fileList.forEach((file) => {
                size += fs.statSync(`${typePath}/${file}`).size;
                if (component.isDirectory) {
                  zip.addLocalFolder(`${typePath}/${file}`, `${folderType}/${file}`);
                } else {
                  zip.addLocalFile(`${typePath}/${file}`, folderType);
                }

                if (size > 1000000) {
                  chunkList[chunkCounter].typeList.push({ componentList, type: type.type, zip :  zip.toBuffer().toString('base64'), size });
                  chunkList.push({ typeList: [] });
                  zip = new AdmZip();
                  size = 0;
                  chunkCounter++;
                  componentList = [];
                }
              });
              delete component.isDirectory;
              delete component.fileList;
            });


          } else {

            const antiDuplicateFieldSet = new Set();
            const prepareObjectList = [];
            folderContentList.forEach((content) => {
              type.componentList.forEach((component) => {
                if (component.apiName.split('.')[0] === content.name.split('.')[0] && !antiDuplicateFieldSet.has(content.name)) {
                  antiDuplicateFieldSet.add(content.name);
                  prepareObjectList.push( { name : content.name, component });
                  component.label = `${folderType}/${content.name}`;
                  type.fileName = content.name;
                }
              });
            });


            const customObjectList = [];
            prepareObjectList.forEach((content) => {
              customObjectList.push({
                file: fs.readFileSync(`${typePath}/${content.name}`, 'utf8'),
                fileName: content.name,
                component: content.component
              })
            });
            const customFieldList = convertToCustomField(customObjectList);
            customFieldList.forEach((customField) => {
              size += customField.file.length;
              zip.addFile(`objects/${customField.fileName}`, Buffer.from(customField.file, 'utf-8'), '');
              componentList.push(customField.component);
              if (size > 1000000) {
                chunkList[chunkCounter].typeList.push({ componentList, type: type.type, zip :  zip.toBuffer().toString('base64'), size });
                chunkList.push({ typeList: [] });
                zip = new AdmZip();
                size = 0;
                chunkCounter++;
                componentList = [];
              }
            });
            type.zip = zip.toBuffer().toString('base64');;
          }

          chunkList[chunkCounter].typeList.push({ componentList, type: type.type, zip :  zip.toBuffer().toString('base64'), size });
          zip = new AdmZip();
          componentList = [];
        }
      });

      resolve(chunkList);
      log.log('*** End Create Zip Components');
    } catch (e) {
      log.log('*** Error Create Zip Components');
      reject(e);
    }
  });
}

function convertToCustomField(customObjectList) {
  const customFieldList = [];
  customObjectList.forEach((customObjectXML) => {
    const customFieldRows = [];
    const rows = customObjectXML.file.split('\n');
    let start = false;
    rows.forEach((row) => {

      if (
        row.includes('<?xml version="1.0" encoding="UTF-8"?>') ||
        row.startsWith('<CustomObject') ||
        row.startsWith('</CustomObject')
      ) {
        customFieldRows.push(row);
      }
      if (row.includes('<fields>')) {
        start = true;
      }
      if (start) {
        customFieldRows.push(row);
      }

      if (row.includes('</fields>')) {
        start = false;
      }

    });
    customFieldList.push({
      fileName: customObjectXML.fileName,
      file: customFieldRows.join('\n'),
      component: customObjectXML.component
    });
  });
  return customFieldList;
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
      log.log('*** Start Send Components');
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
        log.log(`*** End Send Components`);
        resolve();
      })
        .catch(reject);

    } catch (e) {
      log.log('*** Error Send Components');
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
          resolve(res.data)
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
