# Wrapper for working with REST API using well-known axios and node-fetch modules

>#### Content
>[About](#about)   
[Config](#config)<br>
[Initialization](#initialization)<br>
[REST clients use](#rest-clients-use)<br>
[Requests execution result](#requests-execution-result)<br>
[More about request options](#more-about-request-options)

<a name="about"><h2>About</h2></a>
The wrapper extends and facilitates the work with modules.

- Inspired by the caching implementation in Apollo GraphQL Server, where the keys are urls with parameters, this was added here, but also left the option to specify the key yourself. Additionally, caching is performed only for responses with specific response statuses that you specify. You can use both Memcached and Redis for data storage.

- It also has the functionality to repeat requests (retry) when receiving statuses that are not expected to be successful.

- Added the ability to create a node-fetch instance like <i>axios.create({})</i>

- Added timeout support to node-fetch using <i>AbortController</i>

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
        cacheService: {
            cachedStatuses: [200],
            redis: cacheServices.redis,
            // memcached: cacheServices.memcached,
        },
    },
};

// who prefers axios
const axios = new Axios(configs);
// who prefers node-fetch
const fetch = new Fetch(configs);

module.exports = { 
    axios, 
    fetch,
};
```
<h6>Configs:</h6>
- <i>configs.baseURL</i> — `${schema}://${hostname}`. The url to specify when creating an axios or node-fetch instance.
  Works if you specify <i>createInstance: true</i>
- <i>configs.optional.createInstance</i> — specify <i>true</i> if you want to create an axios or node-fetch instance and then make requests using only the appropriate API paths
- <i>configs.optional.environment</i> — runtime environment (process.env.NODE_ENV). <i>development</i> enables <i>requestLog</i> param by default
- <i>configs.optional.requestLog</i> — enables logging of all requests of the created instance in the format Apollo GraphQL Server
- <i>configs.optional.cacheService.cachedStatuses</i> — indicates the list of statuses in which caching is performed. Works if you specify <i>createInstance: true</i>
- <i>configs.optional.cacheService.memcached</i> — you can use redis or memcached for caching
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


The info below demonstrates a request using the retry option:
```bash
[/rest-service]
> node index.js
Attempt 1/3 failed for GET https://jsonplaceholder.typicode.com/todos_?completed=true&userId=7: Request failed with status code 404
Attempt 2/3 failed for GET https://jsonplaceholder.typicode.com/todos_?completed=true&userId=7: Request failed with status code 404
Attempt 3/3 failed for GET https://jsonplaceholder.typicode.com/todos_?completed=true&userId=7: Request failed with status code 404
Failed to fetch after 3 attempts for https://jsonplaceholder.typicode.com/todos_?completed=true&userId=7
```

It is set for a specific request and looks like this:
```js
{
  retry: {
    { 
      attempts: 3,
      expectedStatuses: [200, 201],
    }
}
```
<i>How it works:</i>
<br> if the API response status does not match the <i>expectedStatuses</i>, then we will make requests in the number of <i>attempts</i>

<a name="more-about-request-options"><h2>More about request options</h2></a>
You may notice that some options are the same in the instance created in <i>helpers/init.js</i>
and in individual requests.

If the option is checked when creating an instance, it means that it will be applied to all requests. 
If it is not set when creating an instance, but is set for a specific request, then it will work only for this request