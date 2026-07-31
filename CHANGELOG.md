# [2.0.0](https://github.com/yurii-bondar/rest-envelop/compare/1.0.1...2.0.0) (2026-07-31)


* feat!: harden retry/cache reliability, add pluggable cache, backoff, logger, TS types ([f443ab2](https://github.com/yurii-bondar/rest-envelop/commit/f443ab2e76df6115a2a9ab5f0a415205fe7bc29c))


### BREAKING CHANGES

* drops the `node-fetch` dependency in favor of the
native `fetch`/`AbortController` available in Node.js 18+. `engines.node`
is now `>=18`; consumers on older Node versions must upgrade.
