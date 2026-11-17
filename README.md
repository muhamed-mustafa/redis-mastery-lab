# Redis Mastery Lab

A small NestJS lab that builds a correct Redis read-through cache step by step: cache-aside, TTL, invalidation, stampede protection, and lock-guarded cache consistency.

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6) ![node--redis](https://img.shields.io/badge/node--redis-6-DC382D) ![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18)

## About

This is a learning project, not a product. It takes one deliberately tiny domain (a two-item product catalog held in memory) and uses it to work through the problems that appear once a cache sits in front of a data source: stale reads, thundering herds on a cold key, locks that expire mid-operation, and a slow reader overwriting fresh data.

Each topic was developed on its own feature branch and merged in order, so the commit history reads as a progression from a naive cache-aside lookup to a token-owned distributed lock with renewal and Lua-guarded writes.

The data source is an in-memory array. There is no database; the focus is entirely on the Redis side.

## What's Covered

| Pattern | Where | What it models |
| --- | --- | --- |
| Cache-aside (lazy loading) | `ProductsService.findById` | Read from `product:{id}` first; on a miss, load from the source and populate the cache. |
| TTL expiry | `SET ... EX 30` | Cached products expire after 30 seconds, bounding how long a stale entry can live. |
| Invalidation on write | `ProductsService.update` | A price update deletes the cached entry so the next read repopulates it. |
| Cache stampede protection | `SET lock:product:{id} <token> NX PX 10000` | Only one caller rebuilds a missing key. Others poll the cache every 50 ms for up to 2 s, then fail with `503`. |
| Double-checked read | `findById`, after lock acquisition | The cache is re-read once the lock is held, so a caller that waited does not reload the source. |
| Token-owned lock release | `RELEASE_LOCK_SCRIPT` (Lua) | Compare-and-delete: a caller can only release a lock it still owns. |
| Lock renewal (watchdog) | `startLockRenewal`, `RENEW_LOCK_SCRIPT` (Lua) | The 10 s lock is extended every 5 s while work is in flight. Losing ownership aborts the operation. |
| Fenced cache writes | `SET_CACHE_IF_LOCK_OWNED_SCRIPT`, `DELETE_CACHE_IF_LOCK_OWNED_SCRIPT` (Lua) | The cache is written or invalidated atomically, and only if the caller still holds the lock. This is what prevents a slow reader from caching a pre-update value. |

Reads and writes for the same product share one lock key, so an update cannot interleave with an in-flight cache rebuild.

All of the above is built on Redis strings and `EVAL`. Other data structures (hashes, lists, sets, sorted sets, streams) and Pub/Sub are not covered yet.

## Architecture

```
src/
├── main.ts                       # Bootstrap, listens on PORT (default 8000)
├── app.module.ts
├── app.controller.ts             # GET / (Nest starter endpoint)
├── app.service.ts
├── common/utils/sleep.ts
├── redis/
│   ├── redis.module.ts           # Exports RedisService
│   ├── redis.service.ts          # node-redis client, connect/quit on module lifecycle
│   └── redis-lock.scripts.ts     # The four Lua scripts
└── products/
    ├── products.module.ts
    ├── products.controller.ts    # GET and PATCH /products/:id
    ├── products.service.ts       # All caching and locking logic
    ├── products.service.spec.ts  # Unit tests
    ├── products.constants.ts     # MAX_WAIT_MS, RETRY_DELAY_MS
    └── product.interface.ts
data/
└── products.json                 # Sample data, not currently loaded by the app
```

Two feature modules. `RedisModule` owns a single node-redis client: it connects in `onModuleInit`, quits in `onModuleDestroy`, and hands the raw client out through `RedisService.getClient()`. `ProductsModule` imports it and keeps all cache and lock logic in `ProductsService`; the controller only maps `null` to `404`.

The Lua scripts live in one file as string constants and are sent with `EVAL` on each call. The project is ESM (`"type": "module"`, `NodeNext` resolution) with TypeScript in strict mode.

## Tech Stack

- NestJS 11 on Express
- TypeScript 5.9 (strict, ESM)
- node-redis 6 (`redis` package)
- Vitest 4
- Prettier 3
- pnpm

## Getting Started

### Prerequisites

- Node.js (a current LTS release; the repository does not pin a version)
- pnpm
- A Redis server reachable from your machine. The quickest option is Docker:

```bash
docker run -d --name redis-lab -p 6379:6379 redis:7
```

The repository does not ship a Docker Compose file.

### Install and run

```bash
git clone https://github.com/muhamed-mustafa/redis-mastery-lab.git
cd redis-mastery-lab
pnpm install
pnpm start:dev
```

The server listens on `http://localhost:8000`. Redis must be running before startup, because the client connects during module initialization.

Other scripts:

| Script | Purpose |
| --- | --- |
| `pnpm start` | Run once without watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm start:prod` | Run the compiled build (`node dist/main.js`) |
| `pnpm format` / `pnpm format:check` | Prettier write / check |

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8000` | HTTP port |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |

Both are optional. They are read directly from `process.env`; the app does not load a `.env` file, so set them in your shell.

## API Overview

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Nest starter endpoint, returns `Hello World!` |
| `GET` | `/products/:id` | Fetch a product through the cache. `404` if it does not exist, `503` if the cache could not be rebuilt within 2 s. |
| `PATCH` | `/products/:id` | Update a product's price and invalidate its cache entry. Body: `{ "price": number }`. `404` if it does not exist, `503` if the product's lock is currently held. |

Seed products have ids `1` and `2`.

```bash
curl http://localhost:8000/products/1

curl -X PATCH http://localhost:8000/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price": 1500}'
```

The service logs `Cache HIT`, `Cache MISS`, and `Cache HIT AFTER WAIT` to the console, which makes the behaviour easy to follow while issuing requests.

## Testing

```bash
pnpm test            # run all tests once
pnpm test:watch      # watch mode
pnpm test:products   # only the ProductsService spec
```

The suite is a single spec with 10 unit tests for `ProductsService`. It runs against a mocked Redis client, so no Redis server is needed. It covers cache hits and misses, missing products, invalidation on update, ten concurrent readers resulting in a single source load and a single cache write, the lock-wait timeout, error preservation when lock release fails, and a read/update interleaving that would otherwise leave stale data in the cache.

Because Redis is mocked, the Lua scripts themselves are not executed by the tests.

## Project Status / Roadmap

Work in progress. The caching and locking chapter is complete; the rest of the lab is not started.

Known limitations:

- Products live in an in-memory array, so updates are lost on restart. `data/products.json` is not wired in.
- `PATCH` does not validate the request body.
- `update` fails fast with `503` when the lock is held instead of waiting, unlike reads.
- Missing products are not cached, so repeated lookups for unknown ids always reach the source.
- The lock is a single-instance lock. It is not Redlock and makes no guarantees across a Redis failover.
- Timings (30 s TTL, 10 s lock, 5 s renewal) are hard-coded.

Possible next steps:

- Integration tests against a real Redis instance, including the Lua scripts and lock renewal
- Docker Compose file and a `.env.example`
- Negative caching and TTL jitter
- Further Redis topics: hashes, sorted sets, Pub/Sub, streams, rate limiting

---

Built by [muhamed-mustafa](https://github.com/muhamed-mustafa).
