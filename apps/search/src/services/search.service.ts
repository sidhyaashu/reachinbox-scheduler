import { getElasticClient } from '../es-client.js';
import { config } from '../config.js';
import { query } from '@reachinbox/database';
import type { EmailRecord } from '@reachinbox/shared';

export interface SearchQueryOptions {
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface EmailSearchDocument {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  etherealMessageUrl?: string | null;
  createdAt: string;
}

export class SearchService {
  private readonly index = config.ELASTICSEARCH_INDEX;

  /**
   * Idempotently indexes a single email record into Elasticsearch.
   */
  async indexEmailDocument(doc: EmailSearchDocument): Promise<void> {
    const client = getElasticClient();
    await client.index({
      index: this.index,
      id: doc.id,
      document: doc,
      refresh: 'wait_for',
    });
  }

  /**
   * Executes tenant-scoped search across email metadata.
   * STRICT INVARIANT: Must never return records belonging to another tenant/user.
   */
  async searchEmails(
    userId: string,
    options: SearchQueryOptions
  ): Promise<{ items: EmailSearchDocument[]; total: number; page: number; limit: number }> {
    const client = getElasticClient();
    const page = options.page || 1;
    const limit = options.limit || 20;
    const from = (page - 1) * limit;

    // Strict tenant isolation filter
    const filterClauses: any[] = [{ term: { userId } }];

    if (options.status) {
      filterClauses.push({ term: { status: options.status } });
    }

    const mustClauses: any[] = [];
    if (options.q && options.q.trim().length > 0) {
      mustClauses.push({
        multi_match: {
          query: options.q.trim(),
          fields: ['recipient^3', 'subject^2', 'body'],
          fuzziness: 'AUTO',
        },
      });
    } else {
      mustClauses.push({ match_all: {} });
    }

    const searchResponse = await client.search<EmailSearchDocument>({
      index: this.index,
      from,
      size: limit,
      query: {
        bool: {
          must: mustClauses,
          filter: filterClauses,
        },
      },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const total =
      typeof searchResponse.hits.total === 'number'
        ? searchResponse.hits.total
        : searchResponse.hits.total?.value || 0;

    const items = searchResponse.hits.hits.map((hit) => hit._source as EmailSearchDocument);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Rebuilds the Elasticsearch index from the authoritative PostgreSQL database.
   */
  async rebuildIndexFromPostgres(): Promise<{ indexedCount: number }> {
    const client = getElasticClient();
    const sql = `
      SELECT
        id,
        user_id AS "userId",
        sender_id AS "senderId",
        recipient,
        subject,
        body,
        status,
        scheduled_at AS "scheduledAt",
        sent_at AS "sentAt",
        ethereal_message_url AS "etherealMessageUrl",
        created_at AS "createdAt"
      FROM emails;
    `;

    const res = await query<EmailRecord>(sql);
    const emails = res.rows;

    if (emails.length === 0) {
      return { indexedCount: 0 };
    }

    const operations = emails.flatMap((email) => [
      { index: { _index: this.index, _id: email.id } },
      {
        id: email.id,
        userId: email.userId,
        senderId: email.senderId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
        etherealMessageUrl: email.etherealMessageUrl,
        createdAt: email.createdAt.toISOString(),
      },
    ]);

    const bulkResponse = await client.bulk({ refresh: true, operations });
    if (bulkResponse.errors) {
      console.error('[SearchService] Bulk indexing encountered partial errors.');
    }

    return { indexedCount: emails.length };
  }
}
