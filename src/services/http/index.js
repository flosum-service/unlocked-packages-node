const axios = require('axios');

function post(domain, sessionId, namespacePrefix, body) {
  return new Promise((resolve, reject) => {
    try {
      const headers = {
        Authorization: `OAuth ${sessionId}`,
        'Content-Type': 'application/json',
      };
      const prefix = namespacePrefix ? `${namespacePrefix}/` : '';
      const url = `https://${domain}/services/apexrest/${prefix}unlocked-packages`;
      axios.post(url, body, { headers })
        .then((response) => {
          resolve(response);
        }).catch((e) => {
          if (e && e.response && e.response.data) {
            if (typeof e.response.data !== "string") {
              reject(JSON.stringify(e.response.data));
            } else {
              reject(e.response.data);
            }
          } else if (e.request) {
            reject(e.request);
          } else {
            reject(e.message);
          }
      });
    } catch (e) {
      reject(e);
    }
  });
}

function callToolingAPIRequest(instanceUrl, accessToken, query, log) {
  return new Promise((resolve, reject) => {
    try {
      log.log(`Start Call Tooling API Request Query = ${query}`);
      const headers = {
        'Authorization': `OAuth ${accessToken}`,
        'Content-Type': 'application/json',
      };
      const url = `${instanceUrl}/services/data/v51.0/tooling/query/?q=${query}`;
      axios.get(url, { headers })
        .then((response) => {
          log.log(`End Call Tooling API Request`);
          resolve(response.data.records);
        }).catch((e) => {
        if (e && e.response && e.response.data) {
          if (typeof e.response.data !== 'string') {
            log.log(`Error Call Tooling API Request Error: ${JSON.stringify(e.response.data)}`);
            reject(JSON.stringify(e.response.data));
          } else {
            log.log(`Error Call Tooling API Request Error: ${e.response.data}`);
            reject(e.response.data);
          }
        } else if (e.request) {
          log.log(`Error Call Tooling API Request Error: ${e.request}`);
          reject(e.request);
        } else {
          log.log(`Error Call Tooling API Request Error: ${e.message}`);
          reject(e.message);
        }
      });
    } catch (e) {
      log.log(`Error Call Tooling API Request Error: ${e.message}`);
      reject(e);
    }
  });
}

module.exports = {
  post,
  callToolingAPIRequest
};
