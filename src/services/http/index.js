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

module.exports = {
  post,
};
