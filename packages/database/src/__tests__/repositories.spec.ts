import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EmailRepository } from '../repositories/email.repository.js';
import * as poolModule from '../pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Database Migrations Integrity', () => {
  it('contains valid initial migration file with required tables and indexes', () => {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);

    const files = fs.readdirSync(migrationsDir);
    expect(files).toContain('001_initial_schema.sql');

    const sqlContent = fs.readFileSync(path.join(migrationsDir, '001_initial_schema.sql'), 'utf-8');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS senders');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS emails');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS outbox_events');
    expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS slack_integrations');
    expect(sqlContent).toContain('idx_outbox_status_created');
  });
});

describe('EmailRepository Transactional Guarantees', () => {
  let emailRepo: EmailRepository;

  beforeEach(() => {
    emailRepo = new EmailRepository();
    vi.restoreAllMocks();
  });

  it('atomically executes email insert and outbox insert within a transaction', async () => {
    const mockClient = {
      query: vi.fn(),
    };

    const scheduledDate = new Date('2026-10-15T10:00:00Z');
    const mockEmailRecord = {
      id: 'mock-email-uuid',
      userId: 'mock-user-uuid',
      senderId: 'mock-sender-uuid',
      recipient: 'prospect@acme.com',
      subject: 'Quick question',
      body: '<p>Interested in your stack?</p>',
      status: 'SCHEDULED',
      scheduledAt: scheduledDate,
      sentAt: null,
      etherealMessageUrl: null,
      idempotencyKey: 'idemp-1234',
      attempts: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // First query is email insert, second is outbox insert
    mockClient.query
      .mockResolvedValueOnce({ rows: [mockEmailRecord] })
      .mockResolvedValueOnce({ rows: [] });

    vi.spyOn(poolModule, 'withTransaction').mockImplementation(async (callback) => {
      return callback(mockClient as any);
    });

    const result = await emailRepo.createEmailWithOutbox({
      userId: 'mock-user-uuid',
      senderId: 'mock-sender-uuid',
      recipient: 'prospect@acme.com',
      subject: 'Quick question',
      body: '<p>Interested in your stack?</p>',
      scheduledAt: scheduledDate,
      idempotencyKey: 'idemp-1234',
    });

    expect(result.id).toBe('mock-email-uuid');
    expect(mockClient.query).toHaveBeenCalledTimes(2);

    // Verify first query was parameterized INSERT INTO emails
    const emailCall = mockClient.query.mock.calls[0];
    expect(emailCall[0]).toContain('INSERT INTO emails');
    expect(emailCall[1]).toEqual([
      'mock-user-uuid',
      'mock-sender-uuid',
      'prospect@acme.com',
      'Quick question',
      '<p>Interested in your stack?</p>',
      scheduledDate,
      'idemp-1234',
      null,
    ]);

    // Verify second query was INSERT INTO outbox_events with payload
    const outboxCall = mockClient.query.mock.calls[1];
    expect(outboxCall[0]).toContain('INSERT INTO outbox_events');
    expect(outboxCall[1][0]).toBe('mock-email-uuid');
    const outboxPayload = JSON.parse(outboxCall[1][1]);
    expect(outboxPayload.recipient).toBe('prospect@acme.com');
  });
});
