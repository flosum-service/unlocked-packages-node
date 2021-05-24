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

      const typeList = [];

      if (!Array.isArray(packageJSON.Package.types)) {
        packageJSON.Package.types = [packageJSON.Package.types];
      }

      packageJSON.Package.types.forEach((type) => typeList.push(createComponents(type)));

      typeList.forEach((type) => {
        const folderType = constants.METADATA_FOLDER_TYPE_MAP[type.type];
        if (folderType) {
          const typePath = `${projectPath}/${packageName}/${folderType}`;
          const folderContentList = fs.readdirSync(
            typePath,
            { withFileTypes: true }
          );

          if (type.type !== 'CustomField') {
            folderContentList.forEach((content) => {
              type.componentList.forEach((component) => {
                if (content.name.includes(component.apiName)) {
                  component.fileList.push(content.name);
                  component.isDirectory = content.isDirectory();
                  if (!content.name.includes('-meta.xml')) {
                    component.label = `${folderType}/${content.name}`;
                  }
                }
              });
            });

            const zip = new AdmZip();
            type.componentList.forEach((component) => {
              if (component.isDirectory) {
                component.fileList.forEach((file) => zip.addLocalFolder(`${typePath}/${file}`, `${folderType}/${file}`));
              } else {
                component.fileList.forEach((file) => zip.addLocalFile(`${typePath}/${file}`, folderType));
              }
              delete component.isDirectory;
              delete component.fileList;
            });
            type.zip = zip.toBuffer().toString('base64');
          } else {

            const customObjectSet = new Set();
            folderContentList.forEach((content) => {
              type.componentList.forEach((component) => {
                if (component.apiName.includes(content.name.split('.')[0])) {
                  customObjectSet.add(content.name);
                  component.label = `${folderType}/${content.name}`;
                  type.fileName = content.name;
                }
              });
            });


            const customObjectList = [];
            customObjectSet.forEach((file) => {

              customObjectList.push({
                file: fs.readFileSync(`${typePath}/${file}`, 'utf8'),
                fileName: file
              })
            });
            const customFieldList = convertToCustomField(customObjectList);
            const zip = new AdmZip();
            customFieldList.forEach((customField) =>
              zip.addFile(`objects/${customField.fileName}`, Buffer.from(customField.file, 'utf-8'), '')
            );
            type.zip = zip.toBuffer().toString('base64');;
          }
        }
      });

      resolve(typeList);
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
      file: customFieldRows.join('\n')
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

function callCreateSnapshot(flosumUrl, flosumToken, namespacePrefix, typeList, packageName, snapshotName, orgId, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('*** Start Create Snapshot');
      const resBody = { packageName, typeList, orgId, snapshotName };
      const body = { methodType: constants.METHOD_TYPE_CREATE_SNAPSHOT, body: JSON.stringify(resBody) };
      http.post(flosumUrl, flosumToken, namespacePrefix.replace('__', ''), JSON.stringify(body))
        .then((res) => {
          log.log(`*** End Create Snapshot`);
          resolve();
        })
        .catch((error) => {
          log.log('*** Error Create Snapshot');
          reject(error);
        });
    } catch (e) {
      log.log('*** Error Create Snapshot');
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
  callCreateSnapshot,
  callUpdateInfo
}
