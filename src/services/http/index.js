const axios = require('axios');

function post(domain, sessionId, namespacePrefix, body) {
  return new Promise((resolve, reject) => {
    try {
      const headers = {
        Authorization: `OAuth ${sessionId}`,
        // Authorization: 'OAuth 00D2w00000FaaEC!AQEAQDqysXj3J_eRVv.fB63AjvR6ijh4my2XvRwD6iY.kgKlAkFOE5RDeKKhCXqZ.wlQOohfBe8mBJhhv0Qnt8pTIT_JkC_I',
        'Content-Type': 'application/json',
      };
      // const url = 'https://up-karpes-dev-ed-dev-ed.my.salesforce.com/services/apexrest/unlocked-packages';
      const prefix = namespacePrefix ? `${namespacePrefix}/` : '';
      const url = `https://${domain}/services/apexrest/${prefix}unlocked-packages`;
      axios.post(url, body, { headers }).then((response) => {
        resolve(response);
      }).catch((e) => {
        reject(e);
      });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  post,
};
