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

      packageJSON.Package.types.forEach((type) => {
        typeList.push(createComponents(type))
      });

      const componentList = [];

      typeList.forEach((type) => {
        const folderType = constants.METADATA_FOLDER_TYPE_MAP[type.type];
        if (folderType) {
          const typePath = `${projectPath}/${packageName}/${folderType}`;
          const folderContentList = fs.readdirSync(
            typePath,
            { withFileTypes: true }
          );

          const folderComponentList = [];
          if (
            type.type === 'AuraDefinitionBundle' ||
            type.type === 'LightningComponentBundle' ||
            type.type === 'ExperienceBundle' ||
            type.type === 'WaveTemplateBundle'
          ) {

          } else if (type.type !== 'CustomField' && type.type !== 'CustomObject') {
            folderContentList.forEach((content) => {
              if (!content.isDirectory()) {
                folderComponentList.push(content.name);
              }
            });

            folderComponentList.forEach((componentFile) => {
              type.componentList.forEach((component) => {
                if (componentFile.includes(component.apiName)) {
                  component.fileList.push(componentFile);
                }
                if (!componentFile.includes('-meta.xml')) {
                  component.label = `${folderType}/${componentFile}`;
                }
              })
            });

            type.componentList.forEach((component) => {
              const zip = new AdmZip();
              component.fileList.forEach((file) => {
                zip.addLocalFile(`${typePath}/${file}`, folderType);
              });
              component.zip = zip.toBuffer().toString('base64');
              delete component.fileList;
              componentList.push(component);
            });
          }
        }
      });

      resolve(componentList);
      log.log('*** End Create Zip Components');
    } catch (e) {
      log.log('*** Error Create Zip Components');
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

function sentComponentsToFlosum(flosumUrl, flosumToken, namespacePrefix, componentList, packageName, orgId, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('*** Start Sent Components To Flosum');
      const resBody = { packageName, componentList, orgId, };
      const body = { methodType: constants.METHOD_TYPE_CREATE_SNAPSHOT, body: JSON.stringify(resBody) };
      http.post(flosumUrl, flosumToken, namespacePrefix, JSON.stringify(body))
        .then((res) => {
          log.log(`*** End Sent Components To Flosum`);
          resolve();
        })
        .catch((error) => {
          log.log('*** Error Sent Components To Flosum');
          reject(error);
        });
    } catch (e) {
      log.log('*** Error Sent Components To Flosum');
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
      const url = `${flosumUrl}/services/apexrest/${nameSpacePrefix}unlocked-packages`;
      const body = { methodType: constants.METHOD_UPDATE_LOG, body: JSON.stringify(resBody) };
      http.post(url, flosumToken, nameSpacePrefix, body)
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
  sentComponentsToFlosum,
  callUpdateInfo
}
