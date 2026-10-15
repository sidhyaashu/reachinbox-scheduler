# ReachInbox Scheduler — Agent Control & Context File

> Note: This file is kept in sync with [AGENTS.md](file:///c:/Users/ashut/Devlopments/Personal/futuremail/.agents/AGENTS.md). Please refer to `AGENTS.md` for the master specification and phase tracking.

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
