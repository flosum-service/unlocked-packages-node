const axios = require('axios');
const fs = require('fs');
const AdmZip = require('adm-zip');
const convert = require('xml-js');
const childProcess = require('child_process');
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

function callComponentList(domain, sessionId, attachmentIdList, attachmentsCount, log, componentsWithAttachmentList = []) {
  log.log('Start Call Component List');
  return new Promise((resolve, reject) => {
    try {
      const headers = {
        Authorization: `OAuth ${sessionId}`,
        // Authorization: 'OAuth 00D2w00000FaaEC!AQEAQNm5dR52eF5TqkPYRQ7XtAdeo96i_yiUHIIfTKfZLMffzRwkJ7YcFZaaHX0Ap_Fkh6QjbqAkW9HZw0I4bKEzxFXQemuf',
        'Content-Type': 'application/json',
      };
      // const url = 'https://up-karpes-dev-ed-dev-ed.my.salesforce.com/services/apexrest/unlocked-packages';
      const url = `https://${domain}/services/apexrest/unlocked-packages`;
      const body = { methodType: constants.METHOD_TYPE_GET_ATTACHMENTS, body: JSON.stringify(attachmentIdList) };
      axios.post(url, body, { headers }).then((response) => {
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

function setInstanceUrl(projectName, domain) {
  return new Promise((resolve, reject) => {
    try {
      const dir = `./${projectName}/.sfdx`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      const sfdxConfig = `{ "instanceUrl": "https://${domain}" }`;
      fs.writeFile(`${dir}/sfdx-config.json`, sfdxConfig, ((err) => {
        if (err) {
          reject(err);
        }
        resolve();
      }));
    } catch (e) {
      reject(e);
    }
  });
}

function updateExistFile(existFile, zipFile) {
  return new Promise((resolve, reject) => {
    try {
      let currentObject = convert.xml2js(existFile);

      if (currentObject.elements && currentObject.elements.length) {
        if (currentObject.elements[0].elements && currentObject.elements[0].elements.length) {
          let zipObject = convert.xml2js(zipFile);
          if (zipObject.elements && zipObject.elements.length) {
            zipObject = zipObject.elements[0];
            if (zipObject.elements && zipObject.elements.length) {
              currentObject.elements[0].elements.push(...zipObject.elements);
            }
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
      const attachmentList = [];
      let b64ToBlobPromiseChain = Promise.resolve();
      componentsWithAttachmentList.forEach((comp, i) => {
        b64ToBlobPromiseChain = b64ToBlobPromiseChain
          .then(() => b64toBuffer(comp.body, log))
          .then((buffer) => attachmentList.push(buffer));
      });
      b64ToBlobPromiseChain
        .then(() => {
          log.log('End Convert To Buffer');
          resolve(attachmentList);
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

function unzipBuffer(buf, i, projectName, log) {
  return new Promise((resolve, reject) => {
    try {
      const zip = new AdmZip(buf);
      const zipEntries = zip.getEntries();
      const projectDataPath = `${projectName}/${constants.UNZIP_CATALOG_NAME}`;
      let fullPath = `${projectDataPath}/`;
      let isDirectory = true;
      zipEntries.forEach((z) => {
        if (isDirectory) {
          isDirectory = z.isDirectory;
        }
        fullPath = `${projectDataPath}/${z.entryName}`;
        const isExistObject = fs.existsSync(fullPath);
        if (z.isDirectory && !isExistObject) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
        if (!z.isDirectory) {
          const zipFile = z.getData().toString('utf-8');
          if (!isExistObject) {
            fs.writeFileSync(fullPath, zipFile, { recursive: true });
            resolve();
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
        }
      });
      if (isDirectory) {
        resolve();
      }
    } catch (e) {
      reject(e);
    }
  });
}

function unzipComponentList(bufferList, projectName, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Unzip Component List');
      const attachmentList = [];
      let b64ToBlobPromiseChain = Promise.resolve();
      bufferList.forEach((buffer, i) => {
        b64ToBlobPromiseChain = b64ToBlobPromiseChain
          .then(() => unzipBuffer(buffer, i, projectName, log));
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
    } catch (e) {
      log.log(`Error Remove Project${e}`);
      reject(e);
    }
  });
}

function getSFDXProject(projectName) {
  return new Promise((resolve, reject) => {
    try {
      fs.readFile(`${projectName}/sfdx-project.json`, (e, data) => {
        if (e) {
          reject(e);
        }
        const sfdxProject = JSON.parse(data.toString('utf-8'));
        resolve(sfdxProject);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function getInstallationURL(sfdxProject, packageName) {
  return new Promise((resolve, reject) => {
    try {
      Object.keys(sfdxProject.packageAliases).forEach((f) => {
        if (f.includes(`${packageName}@`)) {
          resolve(`https://login.salesforce.com/packaging/installPackage.apexp?p0=${sfdxProject.packageAliases[f]}`);
        }
      });
      reject();
    } catch (e) {
      reject(e);
    }
  });
}

function callUpdateInfo(resBody, domain, sessionId, log) {
  return new Promise((resolve, reject) => {
    try {
      let logText = '';
      log.logs.forEach((log) => {
        logText += `${log}\n`;
      });
      resBody.logs = log.logs;
      log.log('Start Call Update Info');
      const headers = {
        Authorization: `OAuth ${sessionId}`,
        // Authorization: 'OAuth 00D2w00000FaaEC!AQEAQNm5dR52eF5TqkPYRQ7XtAdeo96i_yiUHIIfTKfZLMffzRwkJ7YcFZaaHX0Ap_Fkh6QjbqAkW9HZw0I4bKEzxFXQemuf',
        'Content-Type': 'application/json',
      };
      // const url = 'https://up-karpes-dev-ed-dev-ed.my.salesforce.com/services/apexrest/unlocked-packages';
      const url = `https://${domain}/services/apexrest/unlocked-packages`;

      const body = { methodType: constants.METHOD_TYPE_UPDATE_INFO, body: JSON.stringify(resBody) };
      axios.post(url, body, { headers }).then((response) => {
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
  setInstanceUrl,
  callChildProcess,
  callComponentList,
  convertToBuffer,
  unzipComponentList,
  generatePackageXML,
  getSFDXProject,
  getInstallationURL,
  removeProject,
  addExistProjectToSFDXProject,
  callUpdateInfo,
};
