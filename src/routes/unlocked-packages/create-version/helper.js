const fs = require('fs');
const AdmZip = require('adm-zip');
const convert = require('xml-js');
const http = require('../../../services/http');
const constants = require('../../../constants');

function checkProjectDirectory(projectName) {
  return new Promise((resolve, reject) => {
    try {
      resolve(fs.existsSync(`./${projectName}`));
    } catch (e) {
      reject(e);
    }
  });
}

function generatePackageXML(componentList, projectName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Generate PackageXML');
      const sortedComponentList = componentList.sort((a, b) => ((a.type > b.type) ? 1 : ((b.type > a.type) ? -1 : 0)));
      let packageXML = '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n<types>\n';
      let currentType;
      sortedComponentList.forEach((comp) => {
        if (!currentType) {
          currentType = comp.type;
        }
        if (currentType !== comp.type) {
          packageXML += `<name>${currentType}</name>\n</types>\n<types>\n`;
          currentType = comp.type;
        }
        packageXML += '<members>';
        packageXML += `${comp.name}`;
        packageXML += '</members>\n';
      });
      packageXML += `<name>${currentType}</name>\n</types>\n`;
      packageXML += `<version>${48}</version>\n</Package>`;
      fs.writeFile(`./${projectName}/${constants.UNZIP_CATALOG_NAME}/package.xml`, packageXML, ((e) => {
        if (e) {
          log.log(`Error Generate PackageXML${e}`);
          reject(e);
        } else {
          log.log('End Generate PackageXML');
          resolve();
        }
      }));
    } catch (e) {
      log.log(`Error Generate PackageXML${e}`);
      reject(e);
    }
  });
}

function callComponentList(domain, sessionId, attachmentIdList, attachmentsCount, namespacePrefix, log, componentsWithAttachmentList = []) {
  log.log('Start Call Component List');
  return new Promise((resolve, reject) => {
    try {
      const body = { methodType: constants.METHOD_TYPE_GET_ATTACHMENTS, body: JSON.stringify(attachmentIdList) };
      http.post(domain, sessionId, namespacePrefix, body).then((response) => {
        let { data } = response;
        data = JSON.parse(data);
        log.log(`Component List Length, ${data.recordList.length}`);
        componentsWithAttachmentList.push(...data.recordList);
        if (data.idList && data.idList.length) {
          callComponentList(domain, sessionId, data.idList, attachmentsCount, log, componentsWithAttachmentList)
            .then((result) => resolve(result))
            .catch((e) => {
              reject(e);
            });
        } else if (componentsWithAttachmentList.length === attachmentsCount) {
          log.log('End Call Component List');
          resolve(componentsWithAttachmentList);
        } else {
          log.log('Error Call Component List');
          reject(constants.ATTACHMENTS_DELETED);
        }
      }).catch((e) => {
        log.log(`Error Call Component List\n${e}`);
        reject(e);
      });
    } catch (e) {
      log.log(`Error Call Component List\n${e}`);
      reject(e);
    }
  });
}

function b64toBuffer(b64Data, log) {
  return new Promise((resolve, reject) => {
    try {
      const buf = Buffer.from(b64Data, 'base64');
      resolve(buf);
    } catch (e) {
      log.log(e);
      reject(e);
    }
  });
}

function addSFDXPackage(projectName, sfdxProject, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Add SFDX Package');
      fs.writeFile(`${projectName}/sfdx-project.json`, sfdxProject, ((err) => {
        if (err) {
          log.log(`Error Add SFDX Package\n${err}`);
          reject(err);
        }
        log.log('End Add SFDX Package');
        resolve();
      }));
    } catch (e) {
      log.log(`Error Add SFDX Package\n${e}`);
      reject(e);
    }
  });
}

function updateExistFile(existFile, zipFile) {
  return new Promise((resolve, reject) => {
    try {
      let currentObject = convert.xml2js(existFile);

      if (currentObject.elements && currentObject.elements.length) {
        if (!currentObject.elements[0].elements) {
          currentObject.elements[0].elements = [];
        }
        let zipObject = convert.xml2js(zipFile);
        if (zipObject.elements && zipObject.elements.length) {
          zipObject = zipObject.elements[0];
          if (zipObject.elements && zipObject.elements.length) {
            currentObject.elements[0].elements.push(...zipObject.elements);
          }
        }
      }
      currentObject = convert.js2xml(currentObject);
      resolve(currentObject);
    } catch (e) {
      reject(e);
    }
  });
}

function mergeAttachmentAndComponents(componentList, attachmentList, log) {
  return new Promise((resolve, reject) => {
    try {
      const mergedComponentList = [];
      log.log('Start Merge Attachment And Components');
      componentList.forEach((comp) => {
        attachmentList.forEach((at) => {
          if (at.id === comp.id) {
            const merged = Object.assign(at, comp);
            mergedComponentList.push(merged);
          }
        });
      });
      resolve(mergedComponentList);
      log.log('End Merge Attachment And Components');
    } catch (e) {
      log.log(`Error Merge Attachment And Components\n${e}`);
      reject(e);
    }
  });
}

function addExistProjectToSFDXProject(projectName, packageName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Add Exist Project To SFDX Project');
      const sfdxProjectFile = fs.readFileSync(`${projectName}/sfdx-project.json`);
      const sfdxJson = JSON.parse(sfdxProjectFile);
      sfdxJson.packageDirectories = [{
        path: 'force-app',
        package: packageName,
        versionName: 'ver 0.1',
        versionNumber: '0.1.0.NEXT',
        default: true,
      }];
      fs.writeFile(`${projectName}/sfdx-project.json`, JSON.stringify(sfdxJson), ((err) => {
        if (err) {
          log.log(`Error Add Exist Project To SFDX Project\n${err}`);
          reject(err);
        } else {
          resolve();
          log.log('End Add Exist Project To SFDX Project');
        }
      }));
    } catch (e) {
      log.log(`Error Add Exist Project To SFDX Project\n${e}`);
      reject(e);
    }
  });
}

function convertToBuffer(componentsWithAttachmentList, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Convert To Buffer');
      let b64ToBlobPromiseChain = Promise.resolve();
      componentsWithAttachmentList.forEach((comp, i) => {
        b64ToBlobPromiseChain = b64ToBlobPromiseChain
          .then(() => b64toBuffer(comp.body, log))
          .then((buffer) => {
            comp.body = buffer;
            return Promise.resolve();
          });
      });
      b64ToBlobPromiseChain
        .then(() => {
          log.log('End Convert To Buffer');
          resolve(componentsWithAttachmentList);
        }).catch((e) => {
          log.log(`Error Convert To Buffer\n${e}`);
          reject(e);
        });
    } catch (e) {
      log.log(`Error Convert To Buffer\n${e}`);
      reject(e);
    }
  });
}

function removeFieldsFromObject(fullPath, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Remove Fields From Project');
      const file = fs.readFileSync(fullPath).toString('utf-8');
      const currentObject = convert.xml2js(file);

      if (currentObject.elements && currentObject.elements.length) {
        if (currentObject.elements[0].elements && currentObject.elements[0].elements.length) {
          constants.OBJECT_DATA.forEach((object) => {
            currentObject.elements[0].elements = currentObject.elements[0].elements.filter((e) => e.name !== object);
          });

          fs.writeFile(fullPath, convert.js2xml(currentObject), (err) => {
            if (err) {
              log.log(`Error Remove Fields From Project\n${err}`);
              reject(err);
            }
            log.log('End Remove Fields From Project, Removed');
            resolve();
          });
        } else {
          log.log('End Remove Fields From Project, Not Fields');
          resolve();
        }
      } else {
        log.log('End Remove Fields From Project, Not Fields');
        resolve();
      }
    } catch (e) {
      log.log(`Error Remove Fields From Project\n${e}`);
      reject(e);
    }
  });
}

function unzipBufferBranch(comp, i, projectName, log) {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip(comp.body);
      const zipEntries = zip.getEntries();
      const projectDataPath = `${projectName}/${constants.UNZIP_CATALOG_NAME}`;
      let fullPath = projectDataPath;
      let zipFile = '';
      const isEnd = false;
      zipEntries.forEach((z) => {
        if (!z.isDirectory && !isEnd) {
          fullPath = `${fullPath}/${z.entryName}`;
          zipFile = z.getData().toString('utf-8');
        }
      });
      const isExistObject = fs.existsSync(fullPath);
      if (!isExistObject) {
        zip.extractAllTo(projectDataPath, false);
        if (comp.type === 'CustomObject') {
          removeFieldsFromObject(fullPath, log)
            .then(() => resolve());
        } else {
          resolve();
        }
      } else {
        const file = fs.readFileSync(fullPath).toString('utf-8');
        updateExistFile(file, zipFile)
          .then((newFile) => {
            fs.writeFile(fullPath, newFile, ((err) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            }));
          })
          .catch((e) => reject(e));
      }
    } catch (e) {
      reject(e);
    }
  });
}

function unzipComponentList(componentList, projectName, sourceObjectName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Unzip Component List');
      const attachmentList = [];
      let b64ToBlobPromiseChain = Promise.resolve();
      componentList.forEach((comp, i) => {
        b64ToBlobPromiseChain = b64ToBlobPromiseChain
          .then(() => unzipBufferBranch(comp, i, projectName, log));
      });
      b64ToBlobPromiseChain
        .then(() => {
          log.log('End Unzip Component List');
          resolve(attachmentList);
        }).catch((e) => {
          log.log(`Error Unzip Component List ${e}`);
          reject(e);
        });
    } catch (e) {
      log.log(`Error Unzip Component List ${e}`);
      reject(e);
    }
  });
}

function getSFDXProject(projectName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Get SFDX Project');
      fs.readFile(`${projectName}/sfdx-project.json`, (e, data) => {
        if (e) {
          log.log(`Error Get SFDX Project\n${e}`);
          reject(e);
        }
        const sfdxProject = JSON.parse(data.toString('utf-8'));
        log.log('End Get SFDX Project');
        log.log(sfdxProject);
        resolve(sfdxProject);
      });
    } catch (e) {
      log.log(`Error Get SFDX Project\n${e}`);
      reject(e);
    }
  });
}

function getInstallationURL(sfdxProject, body, log) {
  return new Promise((resolve, reject) => {
    try {
      if (sfdxProject.packageAliases) {
        let versionNumber;
        const number = Object.keys(sfdxProject.packageAliases).length;
        const keys = Object.keys(sfdxProject.packageAliases);
        versionNumber = Object.values(keys)[number - 1];
        log.log('Start Get Installation URL');
        const url = `https://login.salesforce.com/packaging/installPackage.apexp?p0=${sfdxProject.packageAliases[versionNumber]}`;
        log.log(url);
        resolve(url);
      }

      reject('End Get Installation URL None URL');
      log.log('End Get Installation URL None URL');
    } catch (e) {
      log.log(`Error Get Installation URL\n${e}`);
      reject(e);
    }
  });
}

function callUpdateInfo(resBody, domain, sessionId, namespacePrefix, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Call Update Info');
      const body = { methodType: constants.METHOD_TYPE_UPDATE_PACKAGE_VERSION_INFO, body: JSON.stringify(resBody) };
      http.post(domain, sessionId, namespacePrefix, body).then((response) => {
        log.log('End Call Update Info');
        resolve(response);
      }).catch((e) => {
        log.log(`Error Call Update Info\n${e}`);
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  checkProjectDirectory,
  callComponentList,
  convertToBuffer,
  unzipComponentList,
  generatePackageXML,
  getSFDXProject,
  getInstallationURL,
  addExistProjectToSFDXProject,
  mergeAttachmentAndComponents,
  callUpdateInfo,
  addSFDXPackage,
};
