# ReachInbox Scheduler — Agent Control & Context File

## 1. Project Overview & Mission
- **Product**: ReachInbox Scheduler (Outbox Labs Assignment)
- **Role**: Senior Software Architect & Senior TypeScript Engineer
- **Goal**: Build a production-grade, distributed email scheduling service and dashboard that persists jobs, enforces rate limiting, integrates Ethereal SMTP, handles 1,000+ bursts, indexes via Elasticsearch, features real Google/Slack OAuth, and provides BullMQ queue observability.
- **Strict Invariants**:
  - NO cron jobs (no `node-cron`, `agenda`, `crontab`). BullMQ delayed jobs + outbox reconciliation only.
  - Raw parameterized SQL (`pg`) with versioned migrations. NO ORMs (no Prisma, TypeORM).
  - Idempotent execution & transactional outbox pattern.
  - Elasticsearch for tenant-scoped email search.
  - Multi-service monorepo structure with Docker Compose.

---

## 2. Architecture & Service Topology
```
[ Browser / Client ]
       │
       ▼
 [ Nginx Proxy ] (:80 / :443)
       │
       ▼
 [ API Gateway ] (:4000) ─── Auth, Request ID, Rate Limiting, Route Dispatch
       │
       ├──► [ Email API Service ] (:4001) ─── PostgreSQL (Entities + Transactional Outbox)
       │           │
       │           ▼
       ├──► [ Scheduler Service ] (:4002) ─── Polls Outbox ──► Dispatches to BullMQ / Redis
       │                                                              │
       ├──► [ Email Worker Service ] (:4003) ◄────────────────────────┘
       │           │ (Processes Jobs, Concurrency, Rate Limiting, Inter-send delay)
       │           ├──► Ethereal SMTP
       │           ├──► Slack OAuth / Webhook Alerting
       │           └──► Async Search Ingestion Event
       │
       ├──► [ Search Service ] (:4004) ─── Elasticsearch (Search & Reindex)
       │
       └──► [ BullMQ Dashboard ] (/admin/queues)
```

---

## 3. Phase Tracking

| Phase | Description | Status | Verification & Notes |
|---|---|---|---|
| **Phase 0** | Requirements analysis, Figma check, Architecture proposal, ADRs | ✅ **Completed** | Clarifications, ADR-001, Task Plan approved |
| **Phase 1** | Monorepo setup, TypeScript strict config, shared contracts, linting | ✅ **Completed** | Workspaces, strict tsconfig, Zod schemas, 10 Vitest tests passing |
| **Phase 2** | PostgreSQL schema, raw-SQL versioned migrations, repository layer | ✅ **Completed** | Custom migration runner, connection pool, indices, repos tested |
| **Phase 3** | Email API service, idempotency keys, transactional outbox pattern | 🔄 **In Progress** | `POST /api/v1/emails/schedule`, Outbox events, session auth |
| **Phase 4** | Redis/BullMQ setup, Scheduler dispatch, recovery & reconciliation | ⏳ Pending | Event dispatch, recovery loop, zero-cron |
| **Phase 5** | Email Worker, Nodemailer (Ethereal), Redis token-bucket rate limiter | ⏳ Pending | Concurrency, 2s delay, hourly cap, deferred jobs |
| **Phase 6** | Google OAuth session auth & Slack OAuth rate-limit alert integration | ⏳ Pending | Real OAuth flows, secure cookie session |
| **Phase 7** | Search service with Elasticsearch, async indexing & reindexing | ⏳ Pending | Tenant-isolated search, index mappings |
| **Phase 8** | API Gateway, BFF aggregation layer, Nginx reverse proxy | ⏳ Pending | Unified entry point, request ID propagation |
| **Phase 9** | Docker Compose orchestration, persistent volumes, healthchecks | ⏳ Pending | Postgres, Redis, Elasticsearch, apps in Docker |
| **Phase 10** | Structured logging, OpenTelemetry / Application Insights, metrics | ⏳ Pending | Correlation IDs, Bull-board dashboard |
| **Phase 11** | Concurrency, restart persistence & 1,000-burst load testing | ⏳ Pending | Failure injection, restart test script |
| **Phase 12** | Frontend implementation (Next.js / Tailwind / shadcn) per Figma | ⏳ Pending | Login, Compose modal/page, Scheduled/Sent tables |
| **Phase 13** | Documentation, README, demo script, submission review | ⏳ Pending | GitHub access to Mitrajit & Yadav036, Loom/Video |

---

## 4. Key Architectural Decisions (ADR Index)
- **ADR-001**: Raw Parameterized SQL & Explicit Migration Runner over ORMs.
- **ADR-002**: Transactional Outbox Pattern for Zero-Loss Job Scheduling without Cron.
- **ADR-003**: Redis Sliding-Window / Token-Bucket Rate Limiter with Exponential Deferral.
- **ADR-004**: Decoupled Elasticsearch Indexing via Async Worker Events.
