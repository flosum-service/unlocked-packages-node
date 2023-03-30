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

async function callToolingAPIRequest(instanceUrl, accessToken, query, log) {
    try {
      log.log(`Start Call Tooling API Request Query = ${query}`);

      const headers = {
        'Authorization': `OAuth ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const url = `${instanceUrl}/services/data/v51.0/tooling/query/?q=${query}`;

      const response = await axios.get(url, { headers });

      log.log(`End Call Tooling API Request`);

      return response.data.records;
    } catch (e) {
      let error;
      if (e.response?.data) {
        if (typeof e.response.data !== 'string') {
          error = JSON.stringify(e.response.data);
        } else {
          error = e.response.data;
        }
      } else if (e.request) {
        error = e.request;
      } else {
        error = e.message;
      }

      log.log(`Error Call Tooling API Request Error: ${error}`);
      throw new Error(error);
    }
}

module.exports = {
  post,
  callToolingAPIRequest
};
