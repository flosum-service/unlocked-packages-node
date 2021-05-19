const fs = require('fs');

function setInstanceUrl(projectName, domain, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Set Instance Url');
      const dir = `./${projectName}/.sfdx`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
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

module.exports = {
  setInstanceUrl,
  removeProject
}
