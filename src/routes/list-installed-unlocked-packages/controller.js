const helper = require('./helper');

async function getInstalledPackageList(body, log) {
    try {
      const instanceUrl = body.instanceUrl;
      const accessToken = body.accessToken;
      const withDependencies = body.withDependencies;

      const packages = await helper.callInstalledUnlockedPackages(instanceUrl, accessToken, withDependencies, log);

      if (!withDependencies) {
        return packages;
      }

      await helper.getDependencyPackages(instanceUrl, accessToken, packages, log);

      return packages;
    } catch (e) {
      log.log(e);
      throw e;
    }
}

module.exports = {
  getInstalledPackageList
}
