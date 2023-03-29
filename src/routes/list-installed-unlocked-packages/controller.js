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

      return await helper.getDependencyPackages(instanceUrl, accessToken, packages, log);

    } catch (e) {
      log.log(e);
      throw e;
    }
}

module.exports = {
  getInstalledPackageList
}
