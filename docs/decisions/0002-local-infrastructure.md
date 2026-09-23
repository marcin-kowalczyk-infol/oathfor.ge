# ADR 0002 — Local infrastructure for the scaffold

Date: 2026-09-23. Status: accepted local engineering decision for MVP-02; validation recorded in the development guide.

## Context and decision

The accepted stack needs PostgreSQL and Redis/Messenger. Native PHP is sufficient for the HTTP slice but the observed host lacks ext-redis. Use Docker Compose with PHP 8.5 CLI, PostgreSQL 17 and Redis 7.4. Build pdo_pgsql and redis 6.3.0 into the PHP development image; retain native PHP as an optional kernel-only workflow when its platform requirements are satisfied.

PostgreSQL holds durable application data; Redis Streams is the selected Messenger transport. Cache usage is deferred. Compose creates separate development and synthetic test databases. Domain schemas belong to their later epics; installing Doctrine migrations does not introduce a fake domain entity.

Sources checked 2026-09-23: [PHP image extension installation](https://hub.docker.com/_/php), [PostgreSQL version policy](https://www.postgresql.org/support/versioning/), [PostgreSQL image](https://hub.docker.com/_/postgres), [Redis image](https://hub.docker.com/_/redis), [phpredis 6.3.0](https://pecl.php.net/package/redis), [Symfony 7.4 Redis transport](https://symfony.com/doc/7.4/messenger.html#redis-transport).

## Consequences

Local Compose credentials are visibly `DUMMY` values. PostgreSQL and Redis have no host-published ports; only the API maps to loopback. Use separate Compose project names to isolate databases, streams and volumes between validation runs. These are local safety/lifecycle choices, informed by the Redis image's exposed-port warning and [Compose project isolation](https://docs.docker.com/compose/how-tos/project-name/).

PHP dependencies and generated cache use dedicated volumes to avoid mixing host and container runtime artifacts. Image major/minor tags permit maintenance patches; Composer lockfiles fix PHP package versions. A clean image rebuild may receive upstream security updates. This scaffold is local development infrastructure, not a production topology, backup strategy or monitoring system.
