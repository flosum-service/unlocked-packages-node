const http = require('../../services/http');
const constants = require('../../constants');

function parseInstalledUnlockedPackageList(packageList, withDependencies, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Parse Package List');
      const installedUnlockedPackageList = [];
      if (withDependencies) {
        packageList.forEach((pack) => {
          if (pack.SubscriberPackageVersion && pack.SubscriberPackageVersion.Package2ContainerOptions === 'Unlocked') {
            installedUnlockedPackageList.push({
              name: pack.SubscriberPackage.Name,
              dependencyList: pack.SubscriberPackageVersion.Dependencies ? pack.SubscriberPackageVersion.Dependencies.ids : []
            });
          }
        });
      } else {
        packageList.forEach((pack) => {
          if (pack.SubscriberPackageVersion && pack.SubscriberPackageVersion.Package2ContainerOptions === 'Unlocked') {
            installedUnlockedPackageList.push(pack.SubscriberPackage.Name);
          }
        });
      }

      log.log('End Parse Package List, Installed Unlocked Packages count = ' + installedUnlockedPackageList.length);
      resolve(installedUnlockedPackageList);
    } catch (e) {
      log.log('Error Parse Package List, Installed Unlocked Packages count = ' + e);
      reject(e);
    }
  })
}

function getDependencyPackages(instanceUrl, accessToken, installedUnlockedPackageList, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Get Dependency Packages');
      let promiseChain = Promise.resolve();
      installedUnlockedPackageList.forEach((pack) => {
        if (pack.dependencyList && pack.dependencyList.length) {
          pack.dependencyList.forEach((dependency) => {
            promiseChain = promiseChain
              .then(() => addDependencyInfo(instanceUrl, accessToken, dependency, pack.name, log));
          });
        }
      });

      promiseChain
        .then(() => {
          log.log('End Get Dependency Packages');
          resolve(installedUnlockedPackageList);
        })
        .catch((e) => {
          log.log('Error Get Dependency Packages ' + e);
          reject(e);
        });
    } catch (e) {
      log.log('Error Get Dependency Packages ' + e);
      reject(e);
    }
  })
}

function addDependencyInfo(instanceUrl, accessToken, dependency, packageName, log) {
  return new Promise((resolve, reject) => {
    try {
      http.callToolingAPIRequest(instanceUrl, accessToken, constants.getPackageById(dependency.subscriberPackageVersionId), log)
        .then((dependencyPackageList) => {
          if (dependencyPackageList && dependencyPackageList.length) {
            dependency.name = dependencyPackageList[0].SubscriberPackage.Name;
            dependency.dependencyList = dependencyPackageList[0].SubscriberPackageVersion.Dependencies
              ? dependencyPackageList[0].Dependencies.ids
              : []
            log.log(`On package '${packageName}' founded dependency '${dependency.name}'`);
            if (dependency.dependencyList.length) {
              let promiseChain = Promise.resolve();
              dependency.dependencyList.forEach((dependency1) => {
                promiseChain = promiseChain
                  .then(() => addDependencyInfo(instanceUrl, accessToken, dependency1, dependency.name, log));

                promiseChain
                  .then(resolve)
                  .catch(reject);
              });
            } else {
              resolve(dependency);
            }
          } else {
            resolve(dependency);
          }
        })
        .catch(reject);
    } catch (e) {
      reject(e);
    }
  })
}


module.exports = {
  parseInstalledUnlockedPackageList,
  getDependencyPackages
}

