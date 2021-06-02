function parseInstalledUnlockedPackageList(packageList, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log('Start Parse Package List');
      const installedUnlockedPackageList = [];
      packageList.forEach((pack) => {
        if (pack.SubscriberPackageVersion && pack.SubscriberPackageVersion.Package2ContainerOptions === 'Unlocked') {
          installedUnlockedPackageList.push(pack.SubscriberPackage.Name);
        }
      });
      log.log('End Parse Package List, Installed Unlocked Packages count = ' + installedUnlockedPackageList.length);
      resolve(installedUnlockedPackageList);
    } catch (e) {
      reject(e);
    }
  })
}

module.exports = {
  parseInstalledUnlockedPackageList
}
