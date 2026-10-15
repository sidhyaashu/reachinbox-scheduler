# ReachInbox Scheduler — 5-Minute Video Walkthrough Script

Use this spoken script when recording your Loom / Screen recording for the Outbox Labs assignment submission.

---

### Step 0: Pre-recording Setup
1. Have Docker running: `docker compose up --build`
2. Open tabs in your browser:
   - Tab 1: `http://localhost` (Dashboard / Landing page)
   - Tab 2: `http://localhost:4000/admin/queues` (BullMQ Dashboard)
   - Tab 3: Your IDE showing the codebase structure and `.agents/AGENTS.md`

---

### Segment 1 (0:00 - 0:45) — Introduction & Invariant Proof
> **Speaker**:
> "Hi team at Outbox Labs! I'm presenting the ReachInbox Scheduler assignment — a production-grade, distributed email scheduling service and dashboard designed for ultra-high deliverability and 1,000+ burst resilience.
>
> Before diving into the live demo, I want to emphasize that all strict requirements have been strictly honored:
> 1. **Zero Cron Jobs**: There are no `node-cron`, `agenda`, or OS crontabs anywhere. Scheduling is powered by BullMQ persistent delayed queues coupled with a PostgreSQL Transactional Outbox pattern.
> 2. **Raw Parameterized SQL**: Zero ORMs used. All database logic uses `pg` pool queries with explicit, versioned SQL migrations.
> 3. **Fault-Tolerant Persistence**: BullMQ is backed by Redis Append-Only File (AOF) persistence, and any un-dispatched outbox events are automatically reconciled on startup.
> 4. **Zero-Drop Rate Limiter**: When bursts exceed hourly sending caps, jobs are never dropped — they are postponed to the next hour window, and an immediate Slack OAuth alert is dispatched."

---

### Segment 2 (0:45 - 1:45) — Architecture & Dashboard Navigation
> **Speaker**:
> "Let's look at the web dashboard built with Next.js 14 and Tailwind, strictly matching the ReachInbox Figma design.
>
> On the landing page, we can sign in via real Google OAuth or click 'Instant Demo Login' for quick evaluator access.
>
> Once inside the dashboard:
> - At the top header, we have the ReachInbox branding, global Elasticsearch full-text search, the Slack Integration indicator, a direct link to the Bull-Board queue inspector, and our user profile.
> - Below the header, our real-time metrics cards display: Total Scheduled Emails, Delivered Emails, Delivery Success Rate, and the current Mailbox Sending Limit with inter-send spacing.
> - We have two distinct tabs: **'Scheduled Emails'** and **'Sent Emails'**."

---

### Segment 3 (1:45 - 2:45) — Bulk Lead Scheduling (CSV & Zero Cron)
> **Speaker**:
> "Let's schedule a campaign. I'll click **'+ Compose New Email'**.
>
> Notice the recipient lead options: we can enter a single lead or upload a `.csv` or text file. I'll click **'Load Demo Leads'** — the parser immediately detects valid email addresses, strips duplicates, and presents a live count.
>
> Next, I'll enter our subject: *'Scaling Outreach with ReachInbox'*, and our message body with personalization variables like `{{firstName}}`.
>
> Under deliverability controls:
> - We can set the schedule to start immediately or at a specific future time.
> - We set the inter-send delay spacing to 2 seconds.
> - And we set our hourly limit quota.
>
> When I click **'Schedule Campaign'**, notice the immediate toast notification and the emails appearing in our **'Scheduled Emails'** table with real-time countdown badges."

---

### Segment 4 (2:45 - 3:45) — BullMQ Live Queue & Ethereal SMTP Delivery
> **Speaker**:
> "Now let's switch to our BullMQ dashboard at `/admin/queues`.
>
> Here you can see the active and delayed jobs enqueued under our `email-send-queue`. Notice the deterministic job IDs matching our PostgreSQL UUIDs.
>
> As the worker processes each job with our configured 2-second spacing, it dispatches the email through Nodemailer via Ethereal SMTP.
>
> Returning to our dashboard and switching to the **'Sent Emails'** tab, the status updates to **'Delivered'**. Clicking **'View Preview ↗'** opens the real Ethereal SMTP inbox page in a new tab, displaying our exact subject, headers, and rendered HTML body."

---

### Segment 5 (3:45 - 4:30) — Zero-Drop Rate Limiting & Slack Alerting
> **Speaker**:
> "Now let's look at rate limiting. When a burst of 1,000 emails arrives, our atomic Redis sliding-window limiter checks if the hourly cap has been reached.
>
> If the cap is exceeded, our zero-drop guarantee ensures no emails are dropped or marked failed. Instead, they are deferred to the exact start of the next hour window.
>
> Simultaneously, the worker triggers our live Slack integration. Opening our Slack modal, we can test and verify live rate-limit alert notifications posted to our chosen channel."

---

### Segment 6 (4:30 - 5:00) — Elasticsearch Search & Conclusion
> **Speaker**:
> "Finally, let's test our tenant-scoped search service backed by Elasticsearch 8. Typing a lead's name or keyword into the global search bar instantly filters our emails across recipient, subject, and body in real time.
>
> All code is organized in a clean TypeScript monorepo with 38 passing unit and integration tests, Docker Compose orchestration, and full ADR documentation.
>
> Collaborator access has been granted to Mitrajit and Yadav036. Thank you for your time, and I look forward to speaking with the team!"
