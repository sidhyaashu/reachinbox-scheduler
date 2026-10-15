import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchService } from '../services/search.service.js';
import * as esClientModule from '../es-client.js';

describe('SearchService & Tenant Isolation', () => {
  let mockEsClient: any;
  let searchService: SearchService;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockEsClient = {
      index: vi.fn().mockResolvedValue({ result: 'created' }),
      search: vi.fn(),
      bulk: vi.fn().mockResolvedValue({ errors: false }),
    };

    vi.spyOn(esClientModule, 'getElasticClient').mockReturnValue(mockEsClient);
    searchService = new SearchService();
  });

  it('strictly enforces tenant isolation filter by userId', async () => {
    mockEsClient.search.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _source: {
              id: 'email-1',
              userId: 'tenant-abc',
              recipient: 'lead@reachinbox.ai',
              subject: 'Follow up',
              body: 'Checking in',
              status: 'SENT',
            },
          },
        ],
      },
    });

    const result = await searchService.searchEmails('tenant-abc', {
      q: 'Follow up',
      status: 'SENT',
      page: 1,
      limit: 10,
    });

    expect(mockEsClient.search).toHaveBeenCalledTimes(1);
    const searchCallArgs = mockEsClient.search.mock.calls[0][0];

    // Verify tenant filter clause is strictly present
    const filters = searchCallArgs.query.bool.filter;
    expect(filters).toContainEqual({ term: { userId: 'tenant-abc' } });
    expect(filters).toContainEqual({ term: { status: 'SENT' } });

    // Verify full-text multi-match query
    const must = searchCallArgs.query.bool.must;
    expect(must[0].multi_match.query).toBe('Follow up');
    expect(must[0].multi_match.fields).toEqual(['recipient^3', 'subject^2', 'body']);

    expect(result.items.length).toBe(1);
    expect(result.items[0]?.userId).toBe('tenant-abc');
  });

  it('indexes document into Elasticsearch with exact id', async () => {
    const doc = {
      id: 'email-123',
      userId: 'tenant-abc',
      senderId: 'sender-1',
      recipient: 'lead@test.com',
      subject: 'Hello',
      body: 'Body text',
      status: 'SCHEDULED',
      scheduledAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    await searchService.indexEmailDocument(doc);

    expect(mockEsClient.index).toHaveBeenCalledWith({
      index: expect.any(String),
      id: 'email-123',
      document: doc,
      refresh: 'wait_for',
    });
  });
});
