# rest-envelop

[![npm version](https://img.shields.io/npm/v/rest-envelop.svg)](https://www.npmjs.com/package/rest-envelop)
[![npm downloads](https://img.shields.io/npm/dm/rest-envelop.svg)](https://www.npmjs.com/package/rest-envelop)
[![CI](https://github.com/yurii-bondar/rest-envelop/actions/workflows/ci.yml/badge.svg)](https://github.com/yurii-bondar/rest-envelop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![node](https://img.shields.io/node/v/rest-envelop.svg)](package.json)
[![types](https://img.shields.io/badge/types-included-blue.svg)](index.d.ts)

Wrapper for working with REST APIs using the well-known `axios` module and the native `fetch`
available in Node.js 18+.

>#### Content
>[About](#about)   
[Config](#config)<br>
[Initialization](#initialization)<br>
[REST clients use](#rest-clients-use)<br>
[Requests execution result](#requests-execution-result)<br>
[More about request options](#more-about-request-options)<br>
[Retry &amp; backoff](#retry--backoff)<br>
[Custom cache adapters](#custom-cache-adapters)<br>
[Logging](#logging)<br>
[Errors](#errors)<br>
[TypeScript](#typescript)

<a name="about"><h2>About</h2></a>
The wrapper extends and facilitates the work with modules.

- Inspired by the caching implementation in Apollo GraphQL Server, where the keys are urls with parameters, this was added here, but also left the option to specify the key yourself. Additionally, caching is performed only for responses with specific response statuses that you specify. You can use Redis, Memcached, or **any custom cache client** of your own (see [Custom cache adapters](#custom-cache-adapters)).

- It also has the functionality to repeat requests (retry) when receiving statuses that are not expected to be successful, with configurable **exponential backoff and jitter** between attempts (see [Retry &amp; backoff](#retry--backoff)).

- The `Fetch` client is built on Node's native `fetch`/`AbortController` - no `node-fetch` dependency, no extra install weight. Added the ability to create an instance like <i>axios.create({})</i>, plus timeout support.

- Ships with **TypeScript typings** (`index.d.ts`), an **injectable logger** (bring your own pino/winston instead of `console`), and typed **error classes** (`UnexpectedStatusError`, `RequestTimeoutError`, `CacheError`) so you can branch on failure reasons instead of parsing messages.

- Requires **Node.js >= 18**.

<a name="config"><h2>Config</h2></a>
```js
// config/default.js

const pkg = require('../package.json');

module.exports = {
    app: {
        name: pkg.name,
        version: pkg.version,
        env: process.env.NODE_ENV,
    },
    cacheServices: {
        redis: {
            port: 6379,
            host: '127.0.0.1',
            db: 5,
        },
        memcached: {
            servers: ['127.0.0.1:11211'],
            options: {
                retries: 5,
                retry: 5000,
                remove: true,
                failOverServers: ['127.0.0.1:11214', '127.0.0.1:11215'],
            },
        },
    },
    rest: {
        jsonPlaceholder: {
            schema: 'https',
            hostname: 'jsonplaceholder.typicode.com'
        }
    }
}
```
<h6>cacheServices configs format</h6>
- Supports all possible formats of connection options that it supports [npm package ioredis](https://www.npmjs.com/package/ioredis)
- Supports all possible formats of connection options that it supports [npm package memcached](https://www.npmjs.com/package/memcached)
- Or skip both and pass your own `adapter` - see [Custom cache adapters](#custom-cache-adapters)

<a name="initialization"><h2>Initialization</h2></a>
```js
// helpers/init.js

const config = require('config');
const { Axios, Fetch } = require('rest-envelop');

const { app, cacheServices, rest: { jsonPlaceholder } } = config;

const requestUrl = `${jsonPlaceholder.schema}://${jsonPlaceholder.hostname}`;
const configs = {
    // baseURL: requestUrl,
    timeout: 1000,
    headers: {
        'X-Request-Source': `${app.name}:${app.version}`
    },
    optional: {
        environment: app.env,
        // requestLog: true,
        // createInstance: true,
        // logger: myLogger, // defaults to console; pass `false` to silence
        cacheService: {
            cachedStatuses: [200],
            redis: cacheServices.redis,
            // memcached: cacheServices.memcached,
            // adapter: myCustomCacheClient,
        },
    },
};

// who prefers axios
const axios = new Axios(configs);
// who prefers fetch
const fetch = new Fetch(configs);

module.exports = { 
    axios, 
    fetch,
};
```
<h6>Configs:</h6>
- <i>configs.baseURL</i> — `${schema}://${hostname}`. The url to specify when creating an axios or fetch instance.
  Works if you specify <i>createInstance: true</i><br>
- <i>configs.optional.createInstance</i> — specify <i>true</i> if you want to create an axios or fetch instance and then make requests using only the appropriate API paths<br>
- <i>configs.optional.environment</i> — runtime environment (process.env.NODE_ENV). <i>development</i> enables <i>requestLog</i> param by default<br>
- <i>configs.optional.requestLog</i> — enables logging of all requests of the created instance in the format Apollo GraphQL Server<br>
- <i>configs.optional.logger</i> — a custom logger (`{ info, warn, error }`) to receive request/retry/cache logs instead of `console`. Pass `false` to silence logging entirely. A partial logger (e.g. only `error`) falls back to `console` for the rest<br>
- <i>configs.optional.cacheService.cachedStatuses</i> — indicates the list of statuses in which caching is performed. Works if you specify <i>createInstance: true</i><br>
- <i>configs.optional.cacheService.redis</i> / <i>configs.optional.cacheService.memcached</i> — you can use redis or memcached for caching<br>
- <i>configs.optional.cacheService.adapter</i> — or plug in your own cache client (in-memory LRU, a shared client you already manage, etc.) — see [Custom cache adapters](#custom-cache-adapters)<br>
- <i>configs.headers</i> — here you can specify any headers that should be passed in each request. <br>
<i>P.S.</i> I advise you to use headers like <i>X-Request-Source</i> in your requests (you can of course name it whatever you want), 
this will allow you to determine the sources of requests (for example, between your microservices), this will be extremely useful if you are using Prometheus/Grafana for monitoring

<a name="rest-clients-use"><h2>REST clients use</h2></a>
```js
// clients/jsonPlaceholder.js

const config = require('config');

const { axios, fetch } = require('../helpers/init.js')

const { rest: { jsonPlaceholder } } = config;

// if 'createInstance: true' is not specified in init.js, we need the url for the request here
const requestUrl = `${jsonPlaceholder.schema}://${jsonPlaceholder.hostname}`;
// API paths for requests
const paths = {
    todos: 'todos',
    comments: 'comments',
    users: 'users',
    posts: 'posts',
};
// cache ttl
const ttl = {
    tenMin: 10 * 60,
    thirtyMin: 30 * 60,
    oneHour: 60 * 60
};

module.exports = {
    // USING AXIOS WITHOUT CREATING AN INSTANCE
    async todos(){
        return axios.request(`${requestUrl}/${paths.todos}`, {
            method: 'GET',
            params: { completed: true, userId: 7 },
            // requestLog: true,
            retry: {
                attempts: 3,
                expectedStatuses: [200, 201],
                // backoff: { baseMs: 200, maxMs: 5000, factor: 2, jitter: true },
            },
            cache: {
                ttl: ttl.tenMin,
                // cachedStatuses: [200],
                // key: `${paths.todos}_${completed}_true_userId_7}`,
            },
        })
    },

  // USING AXIOS WITH CREATED AN INSTANCE
  async comments(){
        return axios.request(`/${paths.comments}`, {
          method: 'GET',
          params: { postId: 5 },
          // requestLog: true,
          cache: {
            ttl: ttl.thirtyMin,
            // cachedStatuses: [200],
            // key: `${paths.comments}_postId_5}`,
          },
        })
  },

  // USING FETCH WITHOUT CREATING AN INSTANCE
  async users(){
        return fetch.request(`${requestUrl}/${paths.users}`, {
          method: 'GET',
          cache: {
            ttl: ttl.thirtyMin,
          },
        })
  },

  // USING FETCH WITH CREATED AN INSTANCE
  async createPost(){
        return fetch.request(`/${paths.posts}`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'foo',
            body: 'bar',
            userId: 1,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        })
  }
}
```

<a name="requests-execution-result"><h2>Requests execution result</h2></a>
The result of the request is a format object:
```json
{
  data,
  status,
  headers
}
```
- data — response body
- status — http response status code
- headers — response headers (if the data is returned from the cache, then this field is missing)

When you execute requests and logged them in the terminal, you will see the following 
(the display and format are borrowed from Apollo GraphQL Server):

```bash
[/rest-service]
> node index.js
GET 200: https://jsonplaceholder.typicode.com/todos?completed=true&userId=7 (142 ms.)
GET 200: https://jsonplaceholder.typicode.com/comments?postId=5 (43 ms.)
GET 200: https://jsonplaceholder.typicode.com/users? (36 ms.)
POST 201: https://jsonplaceholder.typicode.com/posts? (506 ms.)
```

If the requests have already been executed and caching is enabled, the logs will be slightly different:

```bash
[/rest-service]
> node index.js
GET: https://jsonplaceholder.typicode.com/todos?completed=true&userId=7 (cached)
GET: https://jsonplaceholder.typicode.com/comments?postId=5 (cached)
GET: https://jsonplaceholder.typicode.com/users? (cached)
POST 201: https://jsonplaceholder.typicode.com/posts? (544 ms.)
```
Usually POST requests are not cached, but if you need it, you can do it, so by passing the necessary parameters for caching

A cache backend outage (Redis/Memcached/your adapter down or unreachable) never fails the request:
a failed cache read is treated as a cache miss, and a failed cache write is just logged as a
warning - either way you still get your HTTP response, and it never counts as a retry attempt.

The info below demonstrates a request using the retry option:
```bash
[/rest-service]
> node index.js
Attempt 1/3 failed for GET https://jsonplaceholder.typicode.com/todos_?completed=true&userId=7: Request failed with status code 404
Attempt 2/3 failed for GET https://jsonplaceholder.typicode.com/todos_?completed=true&userId=7: Request failed with status code 404
Attempt 3/3 failed for GET https://jsonplaceholder.typicode.com/todos_?completed=true&userId=7: Request failed with status code 404
Failed GET https://jsonplaceholder.typicode.com/todos_?completed=true&userId=7 after 4 attempt(s): Unexpected response status: 404
```
<i>How it works:</i>
<br> if the API response status does not match the <i>expectedStatuses</i>, then we will make requests in the number of <i>attempts</i>, waiting between each one according to the [backoff](#retry--backoff) config.
<br> Once retries are exhausted, the original error is thrown (not swallowed) with an extra `.attempts` property attached, so `err.response`/`err.status` etc. from the underlying HTTP client are still intact for you to inspect.

<a name="more-about-request-options"><h2>More about request options</h2></a>
You may notice that some options are the same in the instance created in <i>helpers/init.js</i>
and in individual requests.

If the option is checked when creating an instance, it means that it will be applied to all requests. 
If it is not set when creating an instance, but is set for a specific request, then it will work only for this request

<a name="retry--backoff"><h2>Retry &amp; backoff</h2></a>
```js
{
  retry: {
    attempts: 3,
    expectedStatuses: [200, 201],
    backoff: {
      baseMs: 200,   // delay before the first retry (default: 200)
      maxMs: 5000,   // delay is capped at this value (default: 5000)
      factor: 2,     // exponential growth factor (default: 2)
      jitter: true,  // randomize the delay so retries don't stampede (default: true)
    },
  },
}
```
- Pass `backoff: false` to retry immediately, with no delay (the old behavior).
- Omit `backoff` entirely to get the defaults above.
- Delays are only applied between attempts - never before the first one.

<a name="custom-cache-adapters"><h2>Custom cache adapters</h2></a>
Don't want to depend on Redis or Memcached? Pass any object implementing `get`/`set` and it's
used as-is instead of the built-in redis/memcached clients:

```js
const lru = new Map();

const configs = {
  optional: {
    cacheService: {
      cachedStatuses: [200],
      adapter: {
        async get(key) {
          return lru.get(key);
        },
        async set(key, value, ttl) {
          lru.set(key, value);
          if (ttl) setTimeout(() => lru.delete(key), ttl * 1000).unref();
        },
      },
    },
  },
};
```

<a name="logging"><h2>Logging</h2></a>
By default, request/retry/cache logs go to `console`. To route them through your own logger
(pino, winston, a structured-logging wrapper, etc.), pass `optional.logger`:

```js
const configs = {
  optional: {
    logger: {
      info: (msg) => myLogger.info(msg),
      warn: (msg) => myLogger.warn(msg),
      error: (msg) => myLogger.error(msg),
    },
  },
};
```
A partial logger (e.g. only `error`) falls back to `console` for the methods you don't provide.
Pass `logger: false` to disable all logging from the instance.

<a name="errors"><h2>Errors</h2></a>
`rest-envelop` exports typed error classes so you can branch on failure reasons instead of
parsing error messages:

```js
const { UnexpectedStatusError, RequestTimeoutError, CacheError, RestEnvelopError } = require('rest-envelop');

try {
  await axios.request('/todos', { retry: { expectedStatuses: [200] } });
} catch (err) {
  if (err instanceof UnexpectedStatusError) {
    // err.status, err.expectedStatuses
  } else if (err instanceof RequestTimeoutError) {
    // err.timeout (Fetch client only - axios timeouts surface as the underlying axios error)
  } else if (err instanceof RestEnvelopError) {
    // any other rest-envelop-originated error
  } else {
    // the raw error from axios/fetch itself (e.g. axios's err.response.status)
  }
}
```
All of them extend `RestEnvelopError`, which extends the built-in `Error`.

<a name="typescript"><h2>TypeScript</h2></a>
Type definitions ship in the package (`index.d.ts`) - no `@types/rest-envelop` needed:

```ts
import { Axios, Fetch, RestEnvelopResponse } from 'rest-envelop';

const axios = new Axios({ baseURL: 'https://api.example.com' });

const response: RestEnvelopResponse<{ id: number }> = await axios.request('/users/1');
```
