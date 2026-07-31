/**
 * @description logs request info
 * @param {{info: Function}} logger - logger to write to
 * @param {Number} status - response status
 * @param {String} url - request url
 * @param {Number} duration - duration of the request
 * @param {String} method - http method
 * @return {void}
 */
module.exports = (logger, status, url, duration, method = 'GET') => {
  logger.info(`${method} ${status}: ${url} (${Math.ceil(duration)} ms.)`);
};
