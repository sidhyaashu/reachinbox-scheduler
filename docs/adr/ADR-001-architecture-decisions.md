# Architecture Decision Records (ADRs)

## ADR-001: Monorepo Architecture with Independent Services
- **Status**: Proposed & Approved in Phase 0
- **Context**: The ReachInbox assignment requires a full-stack system comprising an Email API, Scheduler, Email Worker, Search indexing, API Gateway, BFF, and Next.js frontend, within a 48-hour development timeframe.
- **Decision**: Adopt a modular monorepo using npm workspaces (`apps/*` and `packages/*`).
  - `apps/gateway`: Reverse proxy / routing & auth context validation
  - `apps/api`: Email scheduling API & Outbox persistence
  - `apps/scheduler`: Outbox event dispatcher to BullMQ (zero-cron)
  - `apps/worker`: BullMQ consumer, Ethereal SMTP delivery, Redis rate limiting, Slack alerting
  - `apps/search`: Elasticsearch ingestion and querying
  - `apps/web`: Next.js 14 dashboard
  - `packages/shared`: Shared Zod schemas, TypeScript types, error contracts
  - `packages/database`: PostgreSQL connection pool (`pg`) and raw SQL migration runner
- **Consequences**: Ensures clean separation of concerns and independent Dockerfiles while eliminating cross-repo coordination friction.

## ADR-002: Zero-Cron Scheduling via Transactional Outbox & BullMQ Delayed Jobs
- **Status**: Approved
- **Context**: The assignment strictly forbids cron jobs (`node-cron`, `agenda`, `crontab`). The system must survive server restarts without losing jobs or duplicating sends.
- **Decision**: Combine PostgreSQL transactional outbox pattern with BullMQ delayed jobs (`delay = target - now`).
  - When an email is scheduled, an `emails` row and an `outbox_events` row are committed atomically.
  - The scheduler polls pending outbox records via `SELECT ... FOR UPDATE SKIP LOCKED` and dispatches to BullMQ with deterministic job IDs (`email.id`).
  - On restart, BullMQ delayed jobs in Redis persist automatically. Any undispatched outbox events are recovered immediately.

## ADR-003: Redis Sliding-Window Rate Limiting with Job Deferral
- **Status**: Approved
- **Context**: Must enforce minimum inter-send delays (e.g. 2s) and hourly limits per sender across concurrent workers. Excess jobs must never be dropped.
- **Decision**:
  - Inter-send spacing: Redis key tracking `sender:{id}:last_send_timestamp`.
  - Hourly quota: Redis atomic counter `rate_limit:{sender_id}:{YYYYMMDDHH}` with 2-hour TTL.
  - When the hourly quota is reached, the worker calculates milliseconds until the next hour, defers the job in BullMQ (`delay = ms_until_next_hour`), records the event, and triggers a real Slack notification via the stored OAuth token/webhook.

## ADR-004: Raw Parameterized SQL & Explicit Migration Runner
- **Status**: Approved
- **Context**: Master brief mandates raw SQL with `pg` connection pool; forbids Prisma/TypeORM.
- **Decision**: Store plain `.sql` migrations in `packages/database/migrations` (e.g. `001_initial_schema.sql`). Implement a lightweight, transactional migration runner that tracks applied migrations in a `schema_migrations` table.

## ADR-005: Pluggable Alert Architecture (Provider / Plugin Pattern)
- **Status**: Approved & Implemented
- **Context**: As notification channels expand (Slack, Discord, Webhooks, PagerDuty, Datadog/CloudWatch Logs), core email worker and scheduler logic must remain decoupled from specific alert targets.
- **Decision**: Adopt a Strategy/Provider pattern with a central dispatcher:
  - `AlertProvider`: Standard interface with `readonly name: string` and `notify(payload: AlertPayload): Promise<void>`.
  - Built-in providers: `SlackAlertProvider` (OAuth/Webhook), `LogAlertProvider` (structured audit log), `WebhookAlertProvider` (generic JSON webhook).
  - `AlertService`: Registry and dispatcher with Redis atomic deduplication (`rate_limit_alert_sent:{sender_id}:{hour}`) and `Promise.allSettled` fault isolation.
- **Consequences**: New alert destinations can be added dynamically at runtime (`alertService.registerProvider(...)`) or swapped via environment variables with zero code changes to email processing.

