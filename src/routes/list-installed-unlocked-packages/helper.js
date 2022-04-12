const http = require('../../services/http');
const constants = require('../../constants');

async function callInstalledUnlockedPackages(instanceUrl, accessToken, isWithDependencies, log) {
  try {
    if (isWithDependencies) {
      try {
        const installedPackagesList = await http.callToolingAPIRequest(instanceUrl, accessToken, constants.QUERY_INSTALLED_UNLOCKED_PACKAGE_LIST, log);
        return await parseInstalledUnlockedPackageList(installedPackagesList, isWithDependencies, log);
      } catch (e) {
        const responsePackagesList = await http.callToolingAPIRequest(instanceUrl, accessToken, constants.QUERY_INSTALLED_UNLOCKED_PACKAGE_LIST_WITHOUT_DEPEND, log);
        const responsePackagesWithDependencyList = await checkDependencies(instanceUrl, accessToken, responsePackagesList, log);
        return await parseInstalledUnlockedPackageList(responsePackagesWithDependencyList, isWithDependencies, log);
      }
    } else {
      return await http.callToolingAPIRequest(instanceUrl, accessToken, constants.QUERY_INSTALLED_UNLOCKED_PACKAGE_LIST_WITHOUT_DEPEND, log)
    }
  } catch (e) {
    log.log('Error Call Installed Unlocked Packages' + e);
    throw e;
  }
}

async function checkDependencies(instanceUrl, accessToken, installedUnlockedPackageList, log) {
    try {
      const promiseList = [];
      const packagesMap = {};
      installedUnlockedPackageList.forEach((pack) => {
        if (pack.SubscriberPackageVersion && pack.SubscriberPackageVersion.Package2ContainerOptions === 'Unlocked') {
          promiseList.push(http.callToolingAPIRequest(instanceUrl, accessToken, constants.getDependencyQuery(pack.SubscriberPackageVersionId), log));
          packagesMap[pack.SubscriberPackageVersionId] = pack;
        }
      });

      const subscriberPackageVersionList = await Promise.all(promiseList);

      subscriberPackageVersionList.forEach((subPack) => {
        if (subPack && subPack.length && subPack[0].Dependencies && subPack[0].Dependencies.ids) {
          packagesMap[subPack[0].Id].SubscriberPackageVersion.Dependencies = subPack[0].Dependencies;
        }
      });

      return Object.values(packagesMap);
    } catch (e) {
      log.log('Error Check Dependencies' + e);
    }
}

function parseInstalledUnlockedPackageList(packageList, withDependencies, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Parse Package List');
      const installedUnlockedPackageList = [];
      if (withDependencies) {
        packageList.forEach((pack) => {
          if (pack.SubscriberPackageVersion && pack.SubscriberPackageVersion.Package2ContainerOptions === 'Unlocked') {
            installedUnlockedPackageList.push({
              subscriberPackageVersionId: pack.SubscriberPackageVersionId,
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
  callInstalledUnlockedPackages,
  getDependencyPackages
}

