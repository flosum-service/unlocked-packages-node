const fs = require('fs');
const AdmZip = require('adm-zip');
const convert = require('xml-js');
const childProcess = require('child_process');
const http = require('../../../services/http');
const constants = require('../../../constants');

function callChildProcess(command, log, options = {}, isCreateProject = false) {
  return new Promise((resolve, reject) => {
    try {
      log.log(`Start Call Child Process ${command}`);
      childProcess.exec(command, options, ((e, stdout, stderr) => {
        if (e) {
          if (isCreateProject) {
            if (e.message.indexOf(constants.PACKAGE_NAME_MUST_BE_UNIQUE) > -1) {
              log.log(constants.PACKAGE_WITH_THIS_NAME_IS_EXIST);
              resolve(constants.PACKAGE_WITH_THIS_NAME_IS_EXIST);
            }
          }
          log.log(`Error Call Child Process ${command}\n${e}\n${stderr}`);
          reject(e.message);
        } else {
          log.log(`End Call Child Process ${command}`);
          log.log(stdout);
          resolve(stdout);
        }
      }));
    } catch (e) {
      log.log(`Error Call Child Process ${command}\n${e}`);
      reject(e);
    }
  });
}

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

function setInstanceUrl(projectName, domain, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Set Instance Url');
      const dir = `./${projectName}/.sfdx`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      const sfdxConfig = `{ "instanceUrl": "https://${domain}" }`;
      log.log(`Instance Url: https://${domain}`);
      fs.writeFile(`${dir}/sfdx-config.json`, sfdxConfig, ((err) => {
        if (err) {
          log.log(`Error Set Instance Url\n${err}`);
          reject(err);
        }
        log.log('End Set Instance Url');
        resolve();
      }));
    } catch (e) {
      log.log(`Error Set Instance Url\n${e}`);
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
          currentObject.elements[0].elements = currentObject.elements[0].elements.filter((e) => e.name !== 'fields');
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

function removeProject(projectName, log) {
  return new Promise((resolve, reject) => {
    log.log('Start Remove Project');
    try {
      fs.rmdir(`./${projectName}`, { recursive: true }, (e) => {
        if (e) {
          log.log(`Error Remove Project${e}`);
          reject(e);
        }
        log.log('End Remove Project');
        resolve();
      });
      resolve();
    } catch (e) {
      log.log(`Error Remove Project${e}`);
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
        resolve(sfdxProject);
      });
    } catch (e) {
      log.log(`Error Get SFDX Project\n${e}`);
      reject(e);
    }
  });
}

function getInstallationURL(sfdxProject, packageName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Get Installation URL');
      Object.keys(sfdxProject.packageAliases).forEach((f) => {
        if (f.includes(`${packageName}@`)) {
          const url = `https://login.salesforce.com/packaging/installPackage.apexp?p0=${sfdxProject.packageAliases[f]}`;
          resolve(url);
          log.log(`End Get Installation URL\n${url}`);
        }
      });
      reject();
      log.log('End Get Installation URL None URL');
    } catch (e) {
      log.log(`Error Get SFDX Project\n${e}`);
      reject(e);
    }
  });
}

function callSetPackageInfo(resBody, sessionId, domain, namespacePrefix, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Call Set Package Info');
      const body = { methodType: constants.METHOD_TYPE_UPDATE_PACKAGE_INFO, body: JSON.stringify(resBody) };
      http.post(domain, sessionId, namespacePrefix, body).then((response) => {
        log.log('End Call Set Package Info');
        resolve(response);
      }).catch((e) => {
        log.log(`Error Call Set Package Info\n${e}`);
        reject(e);
      });
    } catch (e) {
      log.log(`Error Call Set Package Info\n${e}`);
      reject(e);
    }
  });
}

module.exports = {
  checkProjectDirectory,
  setInstanceUrl,
  callChildProcess,
  convertToBuffer,
  unzipComponentList,
  generatePackageXML,
  getSFDXProject,
  getInstallationURL,
  removeProject,
  addExistProjectToSFDXProject,
  mergeAttachmentAndComponents,
  callSetPackageInfo,
};
