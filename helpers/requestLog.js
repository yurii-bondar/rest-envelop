/**
 * @description logs request info
 * @param {Number} status - response status
 * @param {String} url - request url
 * @param {Number} duration - duration of the request
 * @param {String} method - http method
 * @return {String <'method status: url (duration ms.)'>}
 */
module.exports = (status, url, duration, method = 'NOT SPECIFIED') => {
  console.info(`${method} ${status}: ${url} (${Math.ceil(duration)} ms.)`);
};
