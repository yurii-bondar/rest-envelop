const Axios = require('./src/Axios');
const Fetch = require('./src/Fetch');
const errors = require('./src/errors');

module.exports = {
  Axios,
  Fetch,
  ...errors,
};
