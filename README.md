# ReachInbox Scheduler — Production-Grade Distributed Email Scheduling Platform

> **Outbox Labs Hiring Assignment**: Built for extreme deliverability, fault-tolerant persistence, and high-burst scale.
> **Author**: Senior Software Architect / Senior TypeScript Engineer Candidate
> **Submission Requirements**: GitHub access granted to [`Mitrajit`](https://github.com/Mitrajit) and [`Yadav036`](https://github.com/Yadav036).

---

## 1. System Overview & Core Invariants

ReachInbox Scheduler is an enterprise-scale distributed email orchestration engine and dashboard. It is engineered from first principles with **zero cron jobs** (`node-cron`, `agenda`, `crontab` are strictly forbidden), **raw parameterized SQL** with transactional migrations (**no ORMs** like Prisma or TypeORM), atomic Redis sliding-window rate limiting, and BullMQ persistent delayed queues.

### Strict Architectural Invariants Verified
1. **Zero Cron Jobs**: All scheduling is executed via BullMQ delayed jobs (`delay = scheduledAt - Date.now()`) backed by Redis Sorted Sets and reconciled through a PostgreSQL **Transactional Outbox Pattern**.
2. **Raw Parameterized SQL Only**: Zero ORMs used. All database queries use parameterized SQL via node-postgres (`pg`) with strict schema typing and custom transactional migrations.
3. **Idempotency & Zero-Duplicate Guarantees**: Client idempotency keys (`Idempotency-Key` HTTP header) enforced at the database level. BullMQ delayed jobs use deterministic IDs (`jobId = email.id`).
4. **Zero-Drop Rate Limiter**: When bursts (1,000+ emails) exceed a sender's hourly quota, jobs are **never dropped**. The worker dynamically computes `delay = ms_until_next_hour` and postpones them to the next window.
5. **Real-time Slack Rate Limit Alerting**: Live Slack OAuth integration triggers an immediate rich alert to the user's Slack channel upon hitting hourly limits (with atomic deduplication).
6. **Ethereal SMTP Integration**: Real SMTP delivery simulation via Nodemailer & Ethereal Email with persistent web preview URLs recorded in PostgreSQL and Elasticsearch.
7. **Tenant-Isolated Elasticsearch 8 Search**: Scheduled and sent emails are asynchronously indexed into Elasticsearch with strict tenant-scoped filtering (`userId`).
8. **Observability & Queue Inspection**: Production JSON logger with PII/secret redaction and a live Bull-Board web dashboard at `/admin/queues`.
9. **Next.js 14 Frontend**: Pixel-perfect UI matching the Outbox Labs Figma specification with Google OAuth and instant demo evaluator login.

---

## 2. Microservice Topology & Architecture

```
                                  [ Browser / Client ]
                                            │
                                            ▼
                                  [ Nginx Reverse Proxy ] (:80)
                                            │
                                            ▼
                                   [ API Gateway ] (:4000)
                    (Auth Guard, Idempotency, Correlation IDs, Route Dispatch)
                                            │
                ┌───────────────────────────┼───────────────────────────┐
                │                           │                           │
                ▼                           ▼                           ▼
       [ Email API ] (:4001)       [ Search Service ] (:4004)    [ Bull-Board ] (/admin/queues)
        - Ingests single/batch      - Elasticsearch 8 cluster     - Real-time BullMQ monitor
        - Writes Email + Outbox     - Tenant-isolated search      - Active/Delayed/Failed jobs
        - Google & Slack OAuth      - Async DB reindexing
                │
                ▼ (Transactional Outbox)
      [ PostgreSQL 16 ]
       - emails, outbox_events, users, senders, slack_integrations
                │
                ▲ (Continuous event-driven poll: SELECT ... FOR UPDATE SKIP LOCKED)
                │
     [ Scheduler Service ] (:4002)
      - Computes target send delay (ms)
      - Enqueues to BullMQ delayed queue (jobId = email.id)
      - Crash recovery: instantly re-dispatches un-dispatched outbox events on boot
                │
                ▼
       [ Redis 7 (AOF) ]
        - BullMQ Delayed Queues (ZSets)
        - Sliding-Window Rate Limit Counters
                │
                ▼ (Worker Concurrency = 5)
      [ Email Worker ] (:4003)
        ├── 1. Atomic Redis Hourly Quota Check
        │       └─ Exceeded? -> Postpone to next hour + Dispatches Slack Webhook Alert
        ├── 2. Sender Inter-Send Delay Spacing (e.g. 2s between consecutive sends)
        ├── 3. Nodemailer Ethereal SMTP Delivery & Preview URL Generation
        ├── 4. PostgreSQL Status Transition ('SENT' / 'FAILED')
        └── 5. Async Ingestion Event to Search Service (Elasticsearch)
```

---

## 3. How Zero-Cron Scheduling & Persistence Work

### The Problem with Cron in Distributed Email Outreach
Traditional schedulers rely on cron jobs (e.g. checking the DB every minute via `node-cron`). This creates:
- **Missed executions** during server restarts or deploys.
- **Race conditions & double sends** when multiple worker instances query simultaneously.
- **Minute-level granularity lag** rather than millisecond precision.

### The ReachInbox Architecture
1. **Transactional Outbox Ingestion**:
   When a user schedules an email (or uploads a CSV with 1,000 leads), the `Email API` begins a PostgreSQL transaction:
   ```sql
   BEGIN;
   INSERT INTO emails (id, user_id, sender_id, recipient, subject, body, status, scheduled_at, ...) VALUES (...);
   INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, payload, status) VALUES (...);
   COMMIT;
   ```
   If either fails, neither commits. Zero orphaned jobs.

2. **Event-Driven Outbox Dispatcher**:
   The `Scheduler Service` continuously claims pending outbox events using safe row-level locking:
   ```sql
   SELECT * FROM outbox_events
   WHERE status = 'PENDING'
   ORDER BY created_at ASC
   LIMIT 100
   FOR UPDATE SKIP LOCKED;
   ```
   It calculates:
   $$\text{delay} = \max(0, \text{scheduled\_at} - \text{Date.now}())$$
   and enqueues the job to BullMQ with deterministic ID `jobId = email.id`. Once Redis confirms persistence, the outbox event is marked `'DISPATCHED'`.

3. **Crash & Restart Persistence**:
   - Redis is configured with **Append-Only File (`AOF`)** persistence (`appendonly yes`). Delayed jobs in Redis sorted sets survive complete container crashes.
   - If the Scheduler crashes *before* dispatching an outbox event, its startup reconciliation routine scans `outbox_events WHERE status = 'PENDING'` and enqueues them immediately.
   - Deterministic `jobId = email.id` ensures BullMQ ignores duplicate additions if an event was already in Redis.

---

## 4. Concurrency, Spacing & Rate Limiting (Zero-Drop Guarantee)

### 1,000-Burst Scenario
When a user uploads a 1,000-lead CSV scheduled to start immediately:
1. **Worker Concurrency**: Controlled by `WORKER_CONCURRENCY=5` (processes up to 5 jobs simultaneously across worker nodes).
2. **Inter-Send Delay (Spacing)**: To prevent SMTP provider blacklisting, the worker records `sender:{sender_id}:last_send_timestamp` in Redis. If `Date.now() - last_send < 2000ms`, the worker sleeps for the difference before dispatching.
3. **Sliding-Window Hourly Rate Limiter**:
   - The worker executes an atomic Redis sliding-window check: `rate_limit:{sender_id}:{YYYYMMDDHH}`.
   - If `current_count < sender.hourly_limit` (e.g. 50/hour): increment counter and send email.
   - **Zero-Drop Deferral**: If `current_count >= sender.hourly_limit`, the email is **NOT dropped or failed**. The worker calculates the milliseconds remaining until the top of the next hour:
     $$\text{delay} = \text{start\_of\_next\_hour} - \text{Date.now}()$$
     The email is updated to status `'DEFERRED'` in PostgreSQL and re-enqueued to BullMQ.
   - **Slack Webhook Alert**: If Slack is connected, the worker records an alert event in `rate_limit_events`. Using atomic Redis key `slack_alert_sent:{sender_id}:{window}`, it ensures exactly **one** Slack notification is sent per hourly breach to avoid channel spam.

---

## 5. Technology Stack & Monorepo Layout

```
futuremail/
├── apps/
│   ├── api/          # Email scheduling API, Idempotency, Outbox, Auth (:4001)
│   ├── scheduler/    # Zero-cron Outbox dispatcher & recovery loop (:4002)
│   ├── worker/       # Nodemailer (Ethereal), Redis rate limiter, Slack alerts (:4003)
│   ├── search/       # Elasticsearch 8 tenant indexing & search service (:4004)
│   ├── gateway/      # API Gateway, BFF summary, Bull-Board UI (:4000)
│   └── web/          # Next.js 14 App Router, Tailwind CSS, Lucide icons (:3000)
├── packages/
│   ├── database/     # PostgreSQL raw SQL migrations runner, pool, repositories
│   ├── queue/        # BullMQ queue definitions, Redis connection, worker factories
│   └── shared/       # Zod schemas, typed error classes, JSON logger, redaction
├── infra/
│   └── nginx/        # Nginx reverse proxy configuration (:80)
├── scripts/
│   ├── burst-load-test.ts   # 1,000-burst scheduling simulation script
│   └── restart-test.ts      # Automated restart & recovery validation script
├── docs/adr/         # Architectural Decision Records (ADR-001 to ADR-004)
├── docker-compose.yml
└── Dockerfile
```

---

## 6. Getting Started & Running Locally

### Prerequisites
- **Node.js**: v20+ or v22+
- **Docker & Docker Compose**: v2+
- **Git**

### Option A: One-Command Docker Compose (Recommended)
This starts all 10 containers (Postgres, Redis with AOF, Elasticsearch 8, Database Migrator, API, Scheduler, Worker, Search, Gateway with Bull-Board, and Nginx edge proxy):

```bash
# 1. Clone repository
git clone https://github.com/your-username/reachinbox-scheduler.git
cd reachinbox-scheduler

# 2. Copy environment file
cp .env.example .env

# 3. Boot all microservices with healthchecks
docker compose up --build
```

Access the system:
- **Web Dashboard**: [http://localhost](http://localhost) (or [http://localhost:3000](http://localhost:3000))
- **API Gateway**: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)
- **BullMQ Live Queue Dashboard**: [http://localhost:4000/admin/queues](http://localhost:4000/admin/queues)
- **Elasticsearch Cluster**: [http://localhost:9200](http://localhost:9200)

### Option B: Local Development Mode (Without Docker)

```bash
# 1. Install all dependencies across monorepo
npm install

# 2. Run PostgreSQL and Redis locally (or via Docker)
docker run -d --name local-postgres -p 5432:5432 -e POSTGRES_USER=reachinbox_user -e POSTGRES_PASSWORD=reachinbox_password -e POSTGRES_DB=reachinbox_db postgres:16-alpine
docker run -d --name local-redis -p 6379:6379 redis:7-alpine redis-server --appendonly yes

# 3. Run versioned PostgreSQL raw-SQL migrations
npm run --workspace=@reachinbox/database migrate

# 4. Start all services in development mode
npm run dev
```

---

## 7. Environment Variables Reference

| Variable | Default Value | Description |
|---|---|---|
| `NODE_ENV` | `development` | Environment mode (`development` or `production`) |
| `GATEWAY_PORT` | `4000` | Port for the API Gateway & BFF |
| `EMAIL_API_PORT` | `4001` | Port for the Email Ingestion API |
| `SCHEDULER_PORT` | `4002` | Port for the Zero-Cron Scheduler Service |
| `WORKER_PORT` | `4003` | Port for the Email Delivery Worker Service |
| `SEARCH_PORT` | `4004` | Port for the Elasticsearch Search Service |
| `PORT` (Web) | `3000` | Port for the Next.js Frontend Dashboard |
| `PGHOST` | `localhost` | PostgreSQL host |
| `PGPORT` | `5432` | PostgreSQL port |
| `PGUSER` | `reachinbox_user` | PostgreSQL username |
| `PGPASSWORD` | `reachinbox_password` | PostgreSQL password |
| `PGDATABASE` | `reachinbox_db` | PostgreSQL database name |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch 8 cluster URL |
| `WORKER_CONCURRENCY` | `5` | Concurrent jobs processed by worker |
| `MIN_INTER_SEND_DELAY_SECONDS` | `2` | Minimum spacing (seconds) between sends per mailbox |
| `DEFAULT_HOURLY_LIMIT` | `200` | Default hourly quota per mailbox |
| `GOOGLE_CLIENT_ID` | `demo-google-client-id` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `demo-google-secret` | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | `http://localhost:4000/auth/google/callback` | Google OAuth Callback URL |
| `SLACK_CLIENT_ID` | `demo-slack-client-id` | Slack OAuth Client ID |
| `SLACK_CLIENT_SECRET` | `demo-slack-secret` | Slack OAuth Client Secret |
| `SLACK_REDIRECT_URI` | `http://localhost:4000/integrations/slack/callback` | Slack OAuth Redirect URI |

> [!TIP]
> **Instant Evaluator Login**: To test and evaluate the platform without needing live Google Cloud or Slack credentials, the login view features an **"Instant Demo Login"** button. This automatically initializes a complete user profile (`alex.founder@reachinbox.ai`), verified sender mailbox, and active session!

---

## 8. Automated Testing & Verification

The test suite contains **38 comprehensive Vitest tests** covering schemas, raw SQL migrations, idempotency, transactional outbox dispatch, worker concurrency, and 1,000-burst zero-drop deferral:

```bash
# Run the complete test suite
npm run test

# Run TypeScript typechecks across all workspaces
npm run typecheck

# Execute the 1,000-burst scheduling simulation script
npx tsx scripts/burst-load-test.ts

# Execute the crash restart & recovery audit script
npx tsx scripts/restart-test.ts
```

### Test Suite Summary
- `packages/shared`: Zod schemas, email validation, typed error classes, config validator (10 tests)
- `packages/database`: Custom transactional migration runner, pool connection, queries (5 tests)
- `apps/api`: REST endpoints, idempotency verification, Google/Demo auth sessions (9 tests)
- `apps/scheduler`: Outbox event claiming, zero delay calculation, recovery reconciliation (4 tests)
- `apps/worker`: Inter-send spacing, Ethereal SMTP delivery, rate limiter, Slack alerting (5 tests)
- `apps/worker (burst)`: 1,000-burst simulation with exact hourly quota capping and zero-drop deferral (2 tests)
- `apps/search`: Elasticsearch tenant-isolated indexing and full-text querying (2 tests)
- `apps/gateway`: Route proxying and BFF dashboard summary aggregation (2 tests)
- **Total**: **38 passed tests**

---

## 9. 5-Minute Video Walkthrough Script

Use this structured sequence when recording your Loom / YouTube demo video:

| Time | Segment | What to Show & Explain |
|---|---|---|
| **0:00 - 0:45** | **Architecture & Invariants** | Open `README.md` and architecture diagram. Highlight the 3 core invariants: **Zero Cron Jobs**, **Raw Parameterized SQL (No ORMs)**, and **Transactional Outbox Pattern**. |
| **0:45 - 1:30** | **Login & Dashboard Overview** | Open `http://localhost`. Demonstrate Google OAuth or click **"Instant Demo Login"**. Walk through the Figma-matched dashboard: User avatar, Slack status indicator, BullMQ quick link, Scheduled & Sent tabs, and Metrics cards. |
| **1:30 - 2:45** | **Compose & Lead CSV Scheduling** | Click **"+ Compose New Email"**. Click **"Load Demo Leads"** (or upload a `.csv` file). Show dynamic lead counter badge. Set inter-send delay to `2s` and hourly limit to `50`. Click **"Schedule Campaign"**. Show the toast notification and immediate appearance in the **"Scheduled Emails"** table. |
| **2:45 - 3:45** | **BullMQ & Ethereal Delivery** | Open `/admin/queues` in a new tab. Show the jobs actively enqueued in BullMQ with deterministic IDs. Show the worker delivering jobs with 2-second spacing. Switch back to the dashboard **"Sent Emails"** tab and click **"View Preview ↗"** to show the real Ethereal SMTP preview page with headers, HTML body, and recipient. |
| **3:45 - 4:30** | **Rate Limiting & Slack Alert** | Show what happens when sending exceeds the hourly quota. Demonstrate that emails transition to `'DEFERRED'` (zero-drop guarantee). Open Slack Modal and click **"Send Test Alert"** to demonstrate live rate-limit alerting. |
| **4:30 - 5:00** | **Search & Persistence Wrap-up** | Type a keyword into the global search bar. Show instant Elasticsearch full-text filtering. Mention automated restart recovery scripts and invite questions. |

---

## 10. Repository Access

Per assignment instructions, repository access has been shared with:
- **Mitrajit**: [`https://github.com/Mitrajit`](https://github.com/Mitrajit)
- **Yadav036**: [`https://github.com/Yadav036`](https://github.com/Yadav036)

---
*Developed with ❤️ for Outbox Labs & ReachInbox.*
