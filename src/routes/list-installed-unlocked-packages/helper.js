const http = require('../../services/http');
const constants = require('../../constants');

async function callInstalledUnlockedPackages(instanceUrl, accessToken, isWithDependencies, log) {
  try {
    if (isWithDependencies) {
        const allPackages = await http.callToolingAPIRequest(
            instanceUrl,
            accessToken,
            constants.QUERY_INSTALLED_UNLOCKED_PACKAGE_LIST_WITHOUT_DEPEND,
            log
        );

        const unlockedPackages = await getUnlockedPackagesWithDependencies(
            instanceUrl,
            accessToken,
            allPackages,
            log
        );

        return await parseInstalledUnlockedPackageList(unlockedPackages, isWithDependencies, log);
    } else {
      return await http.callToolingAPIRequest(
          instanceUrl,
          accessToken,
          constants.QUERY_INSTALLED_UNLOCKED_PACKAGE_LIST_WITHOUT_DEPEND,
          log
      );
    }
  } catch (e) {
    log.log('Error Call Installed Unlocked Packages' + e);
    throw e;
  }
}

async function getUnlockedPackagesWithDependencies(instanceUrl, accessToken, installedPackageList, log) {
  try {
    const installedUnlockedPackageList = installedPackageList.filter(p => {
      return p?.SubscriberPackageVersion?.Package2ContainerOptions === 'Unlocked'
    });

    for (const unpack of installedUnlockedPackageList) {
      const versions = await http.callToolingAPIRequest(
          instanceUrl,
          accessToken,
          constants.getDependencyQuery(unpack.SubscriberPackageVersionId),
          log
      );

      if (!versions.length) {
        continue;
      }

      if (!versions[0]?.Dependencies?.ids) {
        continue;
      }

      unpack.SubscriberPackageVersion.Dependencies = versions[0].Dependencies
    }

    return installedUnlockedPackageList;
  } catch (e) {
    log.log('Error Check Dependencies' + e);
    throw e;
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



async function getDependencyPackages(instanceUrl, accessToken, installedUnlockedPackageList, log) {

    try {
      log.log('Start Get Dependency Packages');

      for (const unpack of installedUnlockedPackageList) {
        if (!unpack.dependencyList?.length) {
          continue;
        }

        for (const dependency of unpack.dependencyList) {
          await addDependencyInfo(instanceUrl, accessToken, dependency, unpack.name, log);
        }

        unpack.dependencyList = unpack.dependencyList.filter(u => u.name && u.dependencyList);
      }

      log.log('End Get Dependency Packages');
    } catch (e) {
      log.log('Error Get Dependency Packages ' + e);
      throw e;
    }
}

async function addDependencyInfo(instanceUrl, accessToken, dependency, packageName, log) {
  try {
    const dependencyPackageList = await http.callToolingAPIRequest(
        instanceUrl,
        accessToken,
        constants.getPackageById(dependency.subscriberPackageVersionId),
        log
    );

    if (!dependencyPackageList?.length) {
      return;
    }

    const dependencyResult = dependencyPackageList[0];
    dependency.name = dependencyResult.SubscriberPackage.Name;
    dependency.dependencyList = [];

    if (!dependencyResult.SubscriberPackageVersion?.Dependencies?.ids) {
      return;
    }

    for (const deepDependency of dependencyResult.SubscriberPackageVersion.Dependencies.ids) {
      await addDependencyInfo(instanceUrl, accessToken, deepDependency, dependency.name, log)
    }
  } catch (e) {
    log.log('Error Add Dependency Info ' + e);
    console.log('Error Add Dependency Info ', e);
    throw e;
  }
}


module.exports = {
  callInstalledUnlockedPackages,
  getDependencyPackages
}

