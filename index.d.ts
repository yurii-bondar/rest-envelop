/**
 * Type definitions for rest-envelop.
 */

export interface Logger {
  info?(...args: unknown[]): void;
  warn?(...args: unknown[]): void;
  error?(...args: unknown[]): void;
}

export interface CustomCacheAdapter {
  get(key: string): Promise<string | null | undefined>;
  set(key: string, value: string, ttl: number): Promise<unknown>;
}

export interface RedisCacheOptions {
  [key: string]: unknown;
}

export interface MemcachedCacheOptions {
  servers?: string | string[];
  options?: Record<string, unknown>;
}

export interface CacheServiceOptions {
  /** List of HTTP statuses eligible for caching. Defaults to `[200]`. */
  cachedStatuses?: number[];
  /** Use a custom cache client instead of redis/memcached. */
  adapter?: CustomCacheAdapter;
  /** ioredis connection options/string. Mutually exclusive with `memcached`. */
  redis?: RedisCacheOptions;
  /** memcached connection options. Mutually exclusive with `redis`. */
  memcached?: MemcachedCacheOptions;
}

export interface BackoffOptions {
  /** Base delay in ms for the first retry. Default: 200. */
  baseMs?: number;
  /** Maximum delay in ms between retries. Default: 5000. */
  maxMs?: number;
  /** Exponential growth factor. Default: 2. */
  factor?: number;
  /** Randomize the delay (full jitter). Default: true. */
  jitter?: boolean;
}

export interface RetryOptions {
  /** Number of retry attempts after the first try. */
  attempts?: number;
  /** HTTP statuses that are considered successful and won't trigger a retry. */
  expectedStatuses?: number[];
  /** Backoff configuration between attempts, or `false` to retry immediately. */
  backoff?: BackoffOptions | false;
}

export interface CacheRequestOptions {
  /** Custom cache key. Defaults to the request URL. */
  key?: string;
  /** Time-to-live in seconds. Caching is only active when `ttl` is set. */
  ttl?: number;
  /** Override the instance-level cached statuses for this request only. */
  cachedStatuses?: number[];
}

export interface RequestOptions {
  method?: string;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  requestLog?: boolean;
  cache?: CacheRequestOptions;
  retry?: RetryOptions;
  body?: BodyInit | unknown;
  [key: string]: unknown;
}

export interface RestEnvelopResponse<T = unknown> {
  data: T;
  status: number;
  headers?: Record<string, unknown> | Headers;
}

export interface ClientOptionalConfig {
  environment?: string;
  requestLog?: boolean;
  createInstance?: boolean;
  logger?: Logger | false;
  cacheService?: CacheServiceOptions;
}

export interface ClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
  optional?: ClientOptionalConfig;
  [key: string]: unknown;
}

declare class BaseClient {
  constructor(config: ClientConfig);

  readonly timeout: number;
  readonly environment: string | undefined;
  readonly requestLog: boolean;
  readonly enableRequestLog: boolean;
  readonly logger: Required<Logger>;
  readonly cachedStatuses: number[];

  static absoluteUrl(url: string): boolean;
}

export class Axios extends BaseClient {
  request<T = unknown>(url: string, options?: RequestOptions): Promise<RestEnvelopResponse<T>>;
}

export class Fetch extends BaseClient {
  request<T = unknown>(url: string, options?: RequestOptions): Promise<RestEnvelopResponse<T>>;
}

export class RestEnvelopError extends Error {
  constructor(message: string, meta?: Record<string, unknown>);
}

export class RequestTimeoutError extends RestEnvelopError {
  url: string;
  timeout: number;
  constructor(url: string, timeout: number);
}

export class UnexpectedStatusError extends RestEnvelopError {
  url: string;
  status: number;
  expectedStatuses: number[];
  constructor(url: string, status: number, expectedStatuses?: number[]);
}

export class CacheError extends RestEnvelopError {
  operation: 'get' | 'set';
  key: string;
  cause: Error;
  constructor(operation: 'get' | 'set', key: string, cause: Error);
}
