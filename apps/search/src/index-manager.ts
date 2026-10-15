import { getElasticClient } from './es-client.js';
import { config } from './config.js';

export async function ensureEmailIndex(): Promise<void> {
  const client = getElasticClient();
  const index = config.ELASTICSEARCH_INDEX;

  try {
    const exists = await client.indices.exists({ index });
    if (exists) {
      return;
    }

    console.log(`[Elasticsearch] Index '${index}' not found. Creating index with schema mappings...`);
    await client.indices.create({
      index,
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
      },
      mappings: {
        properties: {
          id: { type: 'keyword' },
          userId: { type: 'keyword' }, // Strict multi-tenant security
          senderId: { type: 'keyword' },
          recipient: {
            type: 'text',
            fields: {
              keyword: { type: 'keyword', ignore_above: 256 },
            },
          },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
          etherealMessageUrl: { type: 'keyword', index: false },
          createdAt: { type: 'date' },
        },
      },
    });

    console.log(`[Elasticsearch] Successfully initialized index '${index}'.`);
  } catch (err: any) {
    console.error(`[Elasticsearch] Failed to ensure index '${index}':`, err.message);
  }
}
