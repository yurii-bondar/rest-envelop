class RestEnvelopError extends Error {
  constructor(message, meta = {}) {
    super(message);
    this.name = this.constructor.name;
    Object.assign(this, meta);
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}

class RequestTimeoutError extends RestEnvelopError {
  constructor(url, timeout) {
    super(`timeout of ${timeout}ms exceeded`, { url, timeout });
  }
}

class UnexpectedStatusError extends RestEnvelopError {
  constructor(url, status, expectedStatuses = []) {
    super(`Unexpected response status: ${status}`, { url, status, expectedStatuses });
  }
}

class CacheError extends RestEnvelopError {
  constructor(operation, key, cause) {
    super(`Cache "${operation}" failed for key "${key}": ${cause?.message}`, {
      operation,
      key,
      cause,
    });
  }
}

module.exports = {
  RestEnvelopError,
  RequestTimeoutError,
  UnexpectedStatusError,
  CacheError,
};
