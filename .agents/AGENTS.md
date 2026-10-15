# ReachInbox Scheduler — Agent Control & Context File

## 1. Project Overview & Mission
- **Product**: ReachInbox Scheduler (Outbox Labs Assignment)
- **Role**: Senior Software Architect & Senior TypeScript Engineer
- **Goal**: Build a production-grade, distributed email scheduling service and dashboard that persists jobs, enforces rate limiting, integrates Ethereal SMTP, handles 1,000+ bursts, indexes via Elasticsearch, features real Google/Slack OAuth, and provides BullMQ queue observability.
- **Strict Invariants**:
  - NO cron jobs (no `node-cron`, `agenda`, `crontab`). BullMQ delayed jobs + transactional outbox reconciliation only.
  - Raw parameterized SQL (`pg`) with versioned migrations. NO ORMs (no Prisma, TypeORM).
  - Idempotent execution & transactional outbox pattern.
  - Elasticsearch for tenant-scoped email search.
  - Multi-service monorepo structure with Docker Compose.
  - Exact Figma light theme UI (Next.js 14, Tailwind CSS, Shadcn UI primitives, Zustand).

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

## 3. Phase Tracking & Verification

| Phase | Description | Status | Verification & Notes |
|---|---|---|---|
| **Phase 0** | Requirements analysis, Figma check, Architecture proposal, ADRs | ✅ **Completed** | Clarifications, ADR-001, Task Plan approved |
| **Phase 1** | Monorepo setup, TypeScript strict config, shared contracts, linting | ✅ **Completed** | Workspaces, strict tsconfig, Zod schemas, 10 Vitest tests passing |
| **Phase 2** | PostgreSQL schema, raw-SQL versioned migrations, repository layer | ✅ **Completed** | Custom migration runner, connection pool, indices, repos tested |
| **Phase 3** | Email API service, idempotency keys, transactional outbox pattern | ✅ **Completed** | `POST /api/v1/emails/schedule`, Outbox events, session auth |
| **Phase 4** | Redis/BullMQ setup, Scheduler dispatch, recovery & reconciliation | ✅ **Completed** | Event dispatch, recovery loop, zero-cron, 20 Vitest tests |
| **Phase 5** | Email Worker, Nodemailer (Ethereal), Redis token-bucket rate limiter | ✅ **Completed** | Concurrency (5), 2s delay, hourly cap, deferred jobs, 25 tests |
| **Phase 6** | Google OAuth session auth & Slack OAuth rate-limit alert integration | ✅ **Completed** | Real OAuth flows, secure cookie session, 30 Vitest tests |
| **Phase 7** | Search service with Elasticsearch, async indexing & reindexing | ✅ **Completed** | Tenant-isolated search, index mappings, 32 tests |
| **Phase 8** | API Gateway, BFF aggregation layer, Nginx reverse proxy | ✅ **Completed** | Unified entry point, Bull-board, proxy routing, 34 tests |
| **Phase 9** | Docker Compose orchestration, persistent volumes, healthchecks | ✅ **Completed** | Multi-stage Dockerfile, compose config validated, 11 containers |
| **Phase 10** | Structured logging, OpenTelemetry / Application Insights, metrics | ✅ **Completed** | Correlation IDs, structured JSON logger, 36 tests |
| **Phase 11** | Concurrency, restart persistence & 1,000-burst load testing | ✅ **Completed** | 1,000-burst deferral tests, restart recovery script, 38 tests |
| **Phase 12** | Frontend implementation (Next.js / Tailwind / shadcn) per Figma | ✅ **Completed** | Pixel-perfect Figma light UI matching all 5 screens, Zustand store, zero lint/build errors |
| **Phase 13** | Documentation, README, demo script, submission review | ✅ **Completed** | Production README, 5-min demo script, ADRs, access setup |

---

## 4. Key Architectural Decisions (ADR Index)
- **ADR-001**: Raw Parameterized SQL & Explicit Migration Runner over ORMs.
- **ADR-002**: Transactional Outbox Pattern for Zero-Loss Job Scheduling without Cron.
- **ADR-003**: Redis Sliding-Window / Token-Bucket Rate Limiter with Exponential Deferral.
- **ADR-004**: Decoupled Elasticsearch Indexing via Async Worker Events.

---

## 5. Frontend & UI Architecture (`apps/web`)
- **Design Tokens**: Pixel-perfect light theme matching Outbox Labs Figma:
  - Neutral canvas: `#F4F5F7` / `#F8FAFC`
  - Cards & Panels: `#FFFFFF`, border `#E5E7EB` / `#E2E8F0`
  - Brand accents: Emerald / Mint Green (`#10B981` / `#059669`)
  - Badge colors: Peach (`#FEF3C7` / `#B45309`) for Scheduled, Gray (`#F3F4F6` / `#4B5563`) for Sent
- **Components**:
  - `apps/web/src/app/page.tsx`: Figma Login card with Google SSO pill and email auth.
  - `apps/web/src/components/Sidebar.tsx`: `ONB` brand badge, Oliver Brown profile card, green outline compose trigger, and `CORE` navigation.
  - `apps/web/src/components/EmailList.tsx`: Single-line horizontal rows, recipient, scheduled/sent badges, star outline, preview snippets.
  - `apps/web/src/components/ComposeView.tsx`: Full compose workspace with recipient tags, CSV file uploader (`+ Upload List`), inline delay and hourly quota settings, rich text toolbar, attachments, and floating `Send Later` popover with calendar picker and quick presets (tomorrow morning, afternoon, custom).
  - `apps/web/src/components/EmailDetailView.tsx`: Complete detail view with back action, star/archive/trash, Amanda Clark sender card, yellow callout alert banner, and attachment cards.
- **State & Data**:
  - Store: `apps/web/src/lib/store.ts` (Zustand store managing view state, active emails, filters, compose form).
  - Centralized API Client: `apps/web/src/lib/api-client.ts` with typed methods.
  - Production build: `next build` passes cleanly (100% type-safe, static generation optimized).

---

## 6. Submission & Reviewer Checklist
- **GitHub Reviewers**:
  - Grant collaborator access to `Mitrajit` and `Yadav036`.
- **Live Deployment**:
  - Hosted URL: `https://reachinbox.ovanthra.com` (Azure VM `104.43.57.147`)
- **Submission Form**:
  - ClickUp Form: `https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST`
- **5-Minute Video Walkthrough Script**:
  1. Login via Google SSO / Test credentials.
  2. Main Dashboard & Figma UI review (Scheduled & Sent lists).
  3. Composing an email with CSV recipient list upload, inter-send delay (2s), and hourly limit.
  4. Scheduling via the calendar popover (`Send Later`).
  5. BullMQ Dashboard (`/admin/queues`) showing delayed jobs.
  6. Ethereal Email SMTP preview link verification.
  7. Server restart resilience test (shutting down scheduler/worker, restarting, verifying jobs dispatch on time).
  8. Rate limit trigger demonstration showing deferral to the next hour and real Slack OAuth alert.
