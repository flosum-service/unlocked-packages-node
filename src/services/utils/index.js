const crypto = require('crypto');

const constants = require('../../constants');

// List of fields to be hidden from logs
const objectsToEncrypt = ['clientId', 'clientSecret', 'code', 'state', 'client_id', 'client_secret'];

// Use for base64 encoding
function encodeBase64(data) {
  const buffer = Buffer.from(data);
  return buffer.toString('base64');
}

// Use for base64 decoding
function decodeBase64(data) {
  const buffer = Buffer.from(data, 'base64');
  return buffer.toString('ascii');
}

// Returns valid URL
function joinURL(...paths) {
  let url = '';
  paths.forEach((path) => {
    let normalizedUrl = path.replace(/(?<!(http(s)?:))(\/){2,}/g, '/');
    const firstSlash = path.indexOf('/');
    if (firstSlash === 0) {
      normalizedUrl = normalizedUrl.substr(1);
    }
    const lastSlash = normalizedUrl.lastIndexOf('/');
    if (lastSlash === normalizedUrl.length - 1) {
      normalizedUrl = normalizedUrl.substr(0, normalizedUrl.length - 1);
    }

    if (url) {
      url += `/${normalizedUrl}`;
    } else {
      url = normalizedUrl;
    }
  });

  return url;
}

// Use to display partially encrypted email in logs
function encryptEmail(email) {
  let encryptedEmail = '';
  if (email) {
    const emailArray = email.split('@');
    const firstLetter = emailArray[0].charAt(0);
    const lastLetter = emailArray[0].charAt(emailArray[0].length - 1);
    encryptedEmail = `${firstLetter}${emailArray[0].substring(1, emailArray[0].length - 2).replace(/[^.]/g, '*')}${lastLetter}@${emailArray[1]}`;
  }

  return encryptedEmail;
}

// Generates signature key
function getSignature(identifier, methodName, key, timestamp) {
  return crypto.createHmac('sha1', key)
    .update(`${identifier}-${methodName}-${timestamp}`)
    .digest('base64');
}

// Returns username from request
function getUserFromRequest(req, log) {
  log('Checking for user name...');
  let user = '';

  if (req.body && req.body.createdBy) {
    log('User name found in POST request body.');
    user = req.body.createdBy;
  } else {
    try {
      if (req.query && req.query.state) {
        const state = JSON.parse(decodeBase64(req.query.state));
        if (state && state.createdBy) {
          log('User name found in GET request query.');
          user = state.createdBy;
        }
      }
    } catch (error) {
      log('Checking user name failed:\n%o', error);
    }
  }

  log(`User name: ${user}.`);
  return user;
}

/*
* General error parser - returns object
* {
*   message: string,
*   original: Object
* }
*/
function getErrorBody(error) {
  if (error && error.message) {
    return {
      message: error.message,
      original: error,
    };
  }

  return {
    message: constants.UNKNOWN_ERROR,
    original: error,
  };
}

// General error handler
function handleError(error) {
  return Promise.reject({
    status: constants.ERROR,
    error: getErrorBody(error),
  });
}

// Get Error message regarding missing field
function getMissingFieldMessage(fieldName) {
  return Promise.reject({
    message: `${constants.REQUEST_MISSING_FIELD}'${fieldName}'.`,
  });
}

// Get Unknown Error message
function getUnknownErrorMessage(message, params) {
  return Promise.reject({
    message: `${message}'${params}'.`,
  });
}

// Get Error message regarding no records found
function getNoRecordsFoundMessage(params) {
  return Promise.reject({
    message: `${constants.NO_RECORDS_FOUND}${params}.`,
  });
}

// Returns type of value
function type(value) {
  const regex = /^\[object (\S+?)\]$/;
  const matches = Object.prototype.toString.call(value).match(regex) || [];

  return (matches[1] || 'undefined').toLowerCase();
}

// Use to encrypt sensitive data in logs
function removeSensitiveData(body) {
  if (body && (type(body) === 'object' || type(body) === 'array')) {
    const updatedBody = JSON.parse(JSON.stringify(body));

    if (Object.getOwnPropertyNames(updatedBody).length) {
      Object.keys(updatedBody).map((elem) => {
        if (updatedBody[elem] && type(updatedBody[elem]) !== 'object' && type(updatedBody[elem]) !== 'array') {
          objectsToEncrypt.some((field) => {
            if (elem === field) {
              updatedBody[elem] = '***';
              return true;
            }

            return false;
          });
        } else if (updatedBody[elem]) {
          updatedBody[elem] = removeSensitiveData(updatedBody[elem]);
        }

        return updatedBody[elem];
      });
    }

    return updatedBody;
  }

  return body;
}

// Use to remove sensitive data fields from objects
function deleteSensitiveFields(instance) {
  delete instance.state;
  delete instance.token;

  return instance;
}

// Transforms string "1.0.22" (or "1.0.22.sql") to Array<Number> [1,0,22]
function getNumberArray(string) {
  return string.split('.sql')[0].split('.').map((key) => {
    const number = Number(key);
    if (Number.isNaN(number)) {
      throw new Error(`Version '${string}' contains invalid characters.`);
    }

    return number;
  });
}

/*
 * version1 and version2 - strings of type '1.0.2' or alike
 * No letters allowed in versions
 * Returns:
 *  negative if version1 less than version2
 *  0 if version1 equals to version2
 *  positive if version1 is greater than version2
 * Example:
 *  "1.22.0" < "1.23"
 *  "1.0.6.9.1" > "1.0.6.9"
 *  "1.1" == "1.1.0.0.0"
 */
function compareVersions(version1, version2) {
  const parsedVersion1 = getNumberArray(version1);
  const parsedVersion2 = getNumberArray(version2);

  let result;
  let i = 0;
  const minLength = Math.min(parsedVersion1.length, parsedVersion2.length);

  while (i < minLength) {
    result = parsedVersion1[i] - parsedVersion2[i];
    if (result === 0) {
      i++;
    } else {
      break;
    }
  }

  if (result === 0) {
    let array = [];
    let multiplier;
    let j = minLength;
    if (parsedVersion1.length > minLength) {
      array = parsedVersion1;
      multiplier = 1;
    } else if (parsedVersion2.length > minLength) {
      array = parsedVersion2;
      multiplier = -1;
    }

    while (j < array.length) {
      if (array[j] > 0) {
        result = array[j] * multiplier;
        break;
      }

      j++;
    }
  }

  return result;
}

module.exports = {
  encodeBase64,
  decodeBase64,
  joinURL,
  encryptEmail,
  getSignature,
  getUserFromRequest,
  getErrorBody,
  handleError,
  getMissingFieldMessage,
  getUnknownErrorMessage,
  getNoRecordsFoundMessage,
  removeSensitiveData,
  deleteSensitiveFields,
  compareVersions,
};
