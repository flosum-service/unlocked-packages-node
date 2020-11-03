const SUCCESS = 'Success';
const ERROR = 'Error';
const METHOD_TYPE_GET_ATTACHMENTS = 'ATTACHMENT';
const METHOD_TYPE_UPDATE_INFO = 'UPDATE INFO';
const STATUS_400_INVALID_JSON_ERROR = 'STATUS 400: Invalid JSON format.';
const STATUS_404_ENDPOINT_NOT_FOUND = 'STATUS 404: Endpoint doesn\'t exist.';
const STATUS_500_INTERNAL_SERVER_ERROR = 'STATUS 500: Internal server error';
const REQUIRED_FIELDS_ERROR = 'Not all required fields are provided.';
const DOMAIN_ID_NOT_PROVIDED = 'Domain Id not provided.';
const COMPONENT_LENGTH_WRONG = 'There must be at least one component.';
const DEV_NODE_ENV = 'development';
const START_CREATE_UNLOCKED_PACKAGE = 'Start Create Unlocked Package';
const ATTACHMENTS_DELETED = 'The definition of some of these components may have been removed.';
const UNZIP_CATALOG_NAME = 'project_data';
const PACKAGE_NAME_MUST_BE_UNIQUE = 'The package name must be unique for the namespace.';
const PACKAGE_WITH_THIS_NAME_IS_EXIST = 'The package with current name is exist.';
const PROJECT_DIRECTORY_IS_EXIST = 'A project with these parameters already exists.';
const PACKAGE_INSTALLATION_URL_NOT_FOUND = 'Package installation URL not found.';

const CREATE_PACKAGE_REQUIRED_FIELDS = ['domain', 'tempLogId', 'unlockedPackageId', 'sessionId', 'orgId', 'userId', 'componentList', 'timestamp', 'packageName', 'versionName', 'username', 'versionKey'];

function getSFDXCreateProject(projectName) {
  return `sfdx force:project:create -n ${projectName}`;
}

function getSFDXConvertMetadata(path) {
  return `sfdx force:mdapi:convert -r ${path}`;
}

function getSFDXCreateUnlockedPackage(packageName, sessionId, description) {
  description = description ? `-d '${description}'` : '';
  return `sfdx force:package:create -n "${packageName}" -t Unlocked -r force-app ${description} -v ${sessionId}`;
}

function getSFDXCreateUnlockedPackageVersion(packageName, sessionId, key, versionName, versionDescription, versionNumber) {
  versionDescription = versionDescription ? `-e '${versionDescription}'` : '';
  versionName = versionName ? `-a ${versionName}` : '';
  versionNumber = versionNumber ? `-n ${versionNumber}` : '';
  return `sfdx force:package:version:create -p "${packageName}" -v ${sessionId} -k ${key} -t Unlocked -d force-app "${versionName}" ${versionDescription} ${versionNumber} --wait 10`;
}
module.exports = {
  SUCCESS,
  ERROR,
  METHOD_TYPE_GET_ATTACHMENTS,
  METHOD_TYPE_UPDATE_INFO,
  STATUS_400_INVALID_JSON_ERROR,
  STATUS_404_ENDPOINT_NOT_FOUND,
  STATUS_500_INTERNAL_SERVER_ERROR,
  DOMAIN_ID_NOT_PROVIDED,
  COMPONENT_LENGTH_WRONG,
  DEV_NODE_ENV,
  START_CREATE_UNLOCKED_PACKAGE,
  ATTACHMENTS_DELETED,
  UNZIP_CATALOG_NAME,
  CREATE_PACKAGE_REQUIRED_FIELDS,
  REQUIRED_FIELDS_ERROR,
  PACKAGE_NAME_MUST_BE_UNIQUE,
  PACKAGE_WITH_THIS_NAME_IS_EXIST,
  PROJECT_DIRECTORY_IS_EXIST,
  PACKAGE_INSTALLATION_URL_NOT_FOUND,
  getSFDXCreateProject,
  getSFDXConvertMetadata,
  getSFDXCreateUnlockedPackage,
  getSFDXCreateUnlockedPackageVersion,
};
